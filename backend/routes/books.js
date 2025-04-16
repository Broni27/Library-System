const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

/**
 * GET /books - Get a list of books
 * Query parameters:
 * @param {string} search - Search by title/author
 * @param {boolean} all - Show all books (true) or only available (false)
 */
router.get('/', async (req, res) => {
    try {
        const {search = '', all = 'false'} = req.query;

        // Log parameters for debugging
        console.log(`[GET /books] Parameters: search="${search}", all=${all}`);

        // Basic query
        let query = `
            SELECT id,
                   title,
                   author,
                   isbn,
                   genre,
                   publication_year,
                   quantity,
                   available_quantity,
                   cover_initials
            FROM books
        `;

        const params = [];

        // Filter conditions
        const conditions = [];

        // Filter by availability (if all books are not requested)
        if (all.toLowerCase() !== 'true') {
            conditions.push('available_quantity > 0');
        }

        // Search filter
        if (search) {
            conditions.push('(title LIKE ? OR author LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        // Add conditions to the query
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Sorting
        query += ' ORDER BY title ASC';

        // Execute the query
        const [books] = await pool.query(query, params);

        // Log the result (first 3 books for example)
        console.log(`[GET /books] Found books: ${books.length}. Example:`, books.slice(0, 3));

        res.json({
            success: true,
            data: books
        });

    } catch (err) {
        console.error('[GET /books] Error:', err);
        res.status(500).json({
            success: false,
            error: 'Error loading books'
        });
    }
});

// Borrowing a book
router.post('/:id/borrow', auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const bookId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(bookId)) {
            throw new Error('Incorrect book ID');
        }

        await connection.beginTransaction();

        // 1. Check the availability of the book with line locking
        const [[book]] = await connection.query(
            `SELECT available_quantity
             FROM books
             WHERE id = ? FOR UPDATE`,
            [bookId]
        );

        if (!book || book.available_quantity <= 0) {
            throw new Error(`Book is not available for pickup`);
        }

        // 2. Check user limit
        const [[activeLoans]] = await connection.query(
            `SELECT COUNT(*) as count
             FROM loans
             WHERE user_id = ? AND is_returned = 0`,
            [userId]
        );

        if (activeLoans.count >= 5) {
            throw new Error('The limit of books borrowed has been reached (maximum 5)');
        }

        // 3. Create a loan record
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // The deadline is 14 days

        const [loanResult] = await connection.query(
            `INSERT INTO loans (user_id, book_id, borrowed_date, due_date)
             VALUES (?, ?, NOW(), ?)`,
            [userId, bookId, dueDate]
        );

        // 4. Reduce the number of available books
        await connection.query(
            `UPDATE books
             SET available_quantity = available_quantity - 1
             WHERE id = ?`,
            [bookId]
        );

        await connection.commit();

        // 5. Forming a response
        const [[updatedBook]] = await pool.query(
            `SELECT b.*,
                    (SELECT COUNT(*)
                     FROM loans
                     WHERE book_id = b.id
                       AND is_returned = 0) as borrowed_count
             FROM books b
             WHERE b.id = ?`,
            [bookId]
        );

        res.json({
            success: true,
            book: updatedBook,
            loan: {
                id: loanResult.insertId,
                due_date: dueDate.toISOString()
            }
        });

    } catch (err) {
        await connection.rollback();
        console.error('[BORROW ERROR]', {
            bookId: req.params.id,
            userId: req.user?.id,
            error: err.message
        });
        res.status(400).json({
            success: false,
            error: err.message || 'Book retrieval error'
        });
    } finally {
        connection.release();
    }
});

// Return of the book (corrected and reliable version)
router.post('/loans/:id/return', auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const loanId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(loanId)) {
            throw new Error('Incorrect loan ID');
        }

        console.log(`[RETURN] User ${userId} returning loan ${loanId}`);

        await connection.beginTransaction();

        // 1. Find the active blocked loan
        const [[loan]] = await connection.query(
            `SELECT id, book_id
             FROM loans
             WHERE id = ?
               AND user_id = ?
               AND is_returned = 0 LIMIT 1 FOR
            UPDATE`,
            [loanId, userId]
        );

        if (!loan) {
            // Diagnostic Inquiry
            const [[existingLoan]] = await connection.query(
                `SELECT id, user_id, is_returned
                 FROM loans
                 WHERE id = ?`,
                [loanId]
            );

            console.log('[RETURN DIAGNOSTIC]', {
                requestedLoanId: loanId,
                existingLoan: existingLoan,
                userId: userId
            });

            throw new Error('Active loan not found. Possible reasons: already returned, does not belong to you or wrong ID');
        }

        // 2. Mark the loan as repaid
        await connection.query(
            `UPDATE loans
             SET returned_date = NOW(),
                 is_returned   = 1
             WHERE id = ?`,
            [loan.id]
        );

        // 3. Increase the number of available books
        await connection.query(
            `UPDATE books
             SET available_quantity = available_quantity + 1
             WHERE id = ?`,
            [loan.book_id]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'The book has been successfully returned',
            returnedLoanId: loan.id,
            bookId: loan.book_id
        });

    } catch (err) {
        await connection.rollback();
        console.error('[RETURN ERROR]', {
            params: req.params,
            user: req.user,
            error: err.message,
            stack: err.stack
        });

        res.status(400).json({
            success: false,
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? {
                loanId: req.params.id,
                userId: req.user?.id
            } : undefined
        });
    } finally {
        connection.release();
    }
});

// Adding a new book (for administrators only)
router.post('/', auth, async (req, res) => {
    try {
        // Check administrator rights
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Administrator rights required'
            });
        }

        // Data validation
        const {title, author, isbn, genre, publication_year, quantity} = req.body;
        const requiredFields = ['title', 'author', 'quantity'];
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Required fields are not filled in: ${missingFields.join(', ')}`
            });
        }

        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'The quantity must be a positive number'
            });
        }

        // Creating a book record
        const coverInitials = `${title.charAt(0)}${author.charAt(0)}`.toUpperCase();

        const [result] = await pool.query(
            `INSERT INTO books (title, author, isbn, genre,
                                publication_year, quantity,
                                available_quantity, cover_initials)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                author,
                isbn || null,
                genre || null,
                publication_year || null,
                parseInt(quantity),
                parseInt(quantity),
                coverInitials
            ]
        );

        // Getting the created book
        const [[newBook]] = await pool.query(
            `SELECT *
             FROM books
             WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            book: newBook
        });

    } catch (err) {
        console.error('[ADD BOOK ERROR]', err);

        // Handling ISBN duplication error
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: 'A book with this ISBN already exists'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Error when adding a book'
        });
    }
});

// Book update (PUT /books/:id)
router.put('/:id', auth, async (req, res) => {
    try {
        // Check administrator rights
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Administrator rights required'
            });
        }
        const bookId = parseInt(req.params.id);
        if (isNaN(bookId)) {
            return res.status(400).json({
                success: false,
                error: 'Incorrect book ID'
            });
        }
        const {title, author, isbn, genre, quantity} = req.body;
        // Validation
        if (!title || !author || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Title, author and quantity are mandatory'
            });
        }
        // Book Update
        await pool.query(
            `UPDATE books
             SET title              = ?,
                 author             = ?,
                 isbn               = ?,
                 genre              = ?,
                 quantity           = ?,
                 available_quantity = quantity - (SELECT COUNT(*) FROM loans WHERE book_id = ? AND is_returned = 0)
             WHERE id = ?`,
            [title, author, isbn || null, genre || null, quantity, bookId, bookId]
        );
        // Getting an updated book
        const [[book]] = await pool.query(
            `SELECT *
             FROM books
             WHERE id = ?`,
            [bookId]
        );
        res.json({
            success: true,
            book
        });
    } catch (err) {
        console.error('[UPDATE BOOK ERROR]', err);
        res.status(500).json({
            success: false,
            error: 'Error when updating the book'
        });
    }
});

// Deleting a book (DELETE /books/:id)
router.delete('/:id', auth, async (req, res) => {
    try {
        // Checking administrator rights
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Administrator rights required'
            });
        }
        const bookId = parseInt(req.params.id);
        if (isNaN(bookId)) {
            return res.status(400).json({
                success: false,
                error: 'Incorrect book ID'
            });
        }
        // Checking to see if there are any active loans of this book
        const [[activeLoans]] = await pool.query(
            `SELECT COUNT(*) as count
             FROM loans
             WHERE book_id = ? AND is_returned = 0`,
            [bookId]
        );
        if (activeLoans.count > 0) {
            return res.status(400).json({
                success: false,
                error: 'You can\'t delete a book because it is in the hands of readers'
            });
        }
        // Deleting the book
        await pool.query(
            `DELETE
             FROM books
             WHERE id = ?`,
            [bookId]
        );
        res.json({
            success: true,
            message: 'The book has been successfully deleted'
        });
    } catch (err) {
        console.error('[DELETE BOOK ERROR]', err);
        res.status(500).json({
            success: false,
            error: 'Error when deleting a book'
        });
    }
});

module.exports = router;