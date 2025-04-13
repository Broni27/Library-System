import { useState, useEffect } from 'react';
import '../../css/pages/Home.css';

function Home({ user }) {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    const fetchBooks = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log("Fetching books from API...");
            const response = await fetch('http://localhost:5000/books');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("API response:", data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to load books');
            }

            if (!Array.isArray(data.data)) {
                throw new Error('Invalid data format received');
            }

            console.log(`Loaded ${data.data.length} books`);
            setBooks(data.data);

        } catch (err) {
            console.error('Error fetching books:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBooks();
    }, []);

    const handleBorrow = async (bookId) => {
        if (!user) {
            setError('Please login to borrow books');
            return;
        }

        try {
            setError(null);
            const response = await fetch(
                `http://localhost:5000/books/${bookId}/borrow`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Borrow failed');
            }

            setBooks(prevBooks =>
                prevBooks.map(book =>
                    book.id === bookId
                        ? { ...book, available_quantity: book.available_quantity - 1 }
                        : book
                )
            );

            setSuccessMsg(`Book borrowed! Due: ${new Date(result.due_date).toLocaleDateString()}`);
            setTimeout(() => setSuccessMsg(null), 5000);

        } catch (err) {
            console.error('Borrow error:', err);
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading books...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p>Error: {error}</p>
                <button onClick={fetchBooks}>Retry</button>
            </div>
        );
    }

    return (
        <div className="books-page">
            {/* Отступ для фиксированного навбара */}
            <div style={{ height: '70px' }}></div>

            {successMsg && (
                <div className="success-message">
                    {successMsg}
                    <button onClick={() => setSuccessMsg(null)}>×</button>
                </div>
            )}

            <h1 className="page-title">Available Books ({books.length})</h1>

            <div className="books-grid">
                {books.map(book => (
                    <div key={book.id} className="book-card">
                        <div className="book-cover">
                            {book.cover_initials || `${book.title.charAt(0)}${book.author.charAt(0)}`}
                        </div>

                        <div className="book-info">
                            <h3>{book.title}</h3>
                            <p>by {book.author}</p>
                            <p>Genre: {book.genre}</p>
                            {book.publication_year && <p>Year: {book.publication_year}</p>}
                            <p>Available: {book.available_quantity}/{book.quantity}</p>
                        </div>

                        <button
                            className={`borrow-btn ${book.available_quantity <= 0 ? 'disabled' : ''}`}
                            onClick={() => handleBorrow(book.id)}
                            disabled={book.available_quantity <= 0 || !user}
                        >
                            {book.available_quantity <= 0 ? 'Not Available' : 'Borrow'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Home;