import { useState, useEffect, useCallback } from 'react';
import BookFilters from '../components/BookFilters';
import '../../css/pages/Home.css';

function Home({ user }) {
    // States
    const [allBooks, setAllBooks] = useState([]);
    const [displayedBooks, setDisplayedBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('title');

    // Loading data
    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const response = await fetch('http://localhost:5000/books?all=true');

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.error || 'Invalid data format');
                }

                setAllBooks(result.data);
                filterAndSortBooks(result.data, '', 'title', false);

            } catch (err) {
                setError(err.message);
                console.error("Book fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBooks();
    }, []);

    // Filtering and sorting function
    const filterAndSortBooks = useCallback((books, searchTerm, sortOption, showAll) => {
        let filtered = [...books];

        // Filtering by availability
        if (!showAll) {
            filtered = filtered.filter(book => book.available_quantity > 0);
        }

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(book => {
                return (
                    book.title?.toLowerCase().includes(term) ||
                    book.author?.toLowerCase().includes(term) ||
                    book.genre?.toLowerCase().includes(term) ||
                    book.isbn?.toLowerCase().includes(term) ||
                    String(book.publication_year)?.includes(term)
                );
            });
        }

        // Sorting
        switch(sortOption) {
            case 'title':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title_desc':
                filtered.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'author':
                filtered.sort((a, b) => a.author.localeCompare(b.author));
                break;
            case 'author_desc':
                filtered.sort((a, b) => b.author.localeCompare(a.author));
                break;
            case 'available':
                filtered.sort((a, b) => b.available_quantity - a.available_quantity);
                break;
            case 'available_asc':
                filtered.sort((a, b) => a.available_quantity - b.available_quantity);
                break;
            default:
                break;
        }

        setDisplayedBooks(filtered);
    }, []);

    // Handlers for filters
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
        filterAndSortBooks(allBooks, term, sortOption, showAll);
    }, [allBooks, sortOption, showAll, filterAndSortBooks]);

    const handleSort = useCallback((option) => {
        setSortOption(option);
        filterAndSortBooks(allBooks, searchTerm, option, showAll);
    }, [allBooks, searchTerm, showAll, filterAndSortBooks]);

    // Switching the display mode
    const toggleShowAll = useCallback(() => {
        const newShowAll = !showAll;
        setShowAll(newShowAll);
        filterAndSortBooks(allBooks, searchTerm, sortOption, newShowAll);
    }, [allBooks, searchTerm, sortOption, showAll, filterAndSortBooks]);

    // Borrowing a book
    const handleBorrow = async (bookId) => {
        try {
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

            // Updating data
            const updatedBooks = allBooks.map(book =>
                book.id === bookId
                    ? { ...book, available_quantity: book.available_quantity - 1 }
                    : book
            );

            setAllBooks(updatedBooks);
            filterAndSortBooks(updatedBooks, searchTerm, sortOption, showAll);

            setSuccessMsg(`Book borrowed! Due: ${new Date(result.loan.due_date).toLocaleDateString()}`);
            setTimeout(() => setSuccessMsg(''), 5000);

        } catch (err) {
            setError(err.message);
        }
    };

    // UI states
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
                <button onClick={() => window.location.reload()}>Try Again</button>
            </div>
        );
    }

    return (
        <div className="books-page">
            {/* Filters and sorting */}
            <BookFilters
                onSearch={handleSearch}
                onSort={handleSort}
            />

            {/* Display control*/}
            <div className="books-header">
                <h1>
                    {showAll ? 'All Books' : 'Available Books'}
                    <span> ({displayedBooks.length})</span>
                </h1>

                <button
                    className={`toggle-btn ${showAll ? 'active' : ''}`}
                    onClick={toggleShowAll}
                >
                    {showAll ? (
                        <>
                            <i className="fas fa-eye-slash"></i> Show Available
                        </>
                    ) : (
                        <>
                            <i className="fas fa-eye"></i> Show All
                        </>
                    )}
                </button>
            </div>

            {/* Messages */}
            {successMsg && (
                <div className="success-message">
                    {successMsg}
                    <button onClick={() => setSuccessMsg('')}>&times;</button>
                </div>
            )}

            {/* List of books */}
            <div className="books-grid">
                {displayedBooks.map(book => {
                    const isAvailable = book.available_quantity > 0;

                    return (
                        <div
                            key={book.id}
                            className={`book-card ${!isAvailable ? 'unavailable' : ''}`}
                        >
                            <div className="book-cover">
                                {book.cover_initials || `${book.title.charAt(0)}${book.author.charAt(0)}`}
                            </div>

                            <div className="book-info">
                                <h3>{book.title}</h3>
                                <p className="author">by {book.author}</p>

                                <div className="book-meta">
                                    <p>{book.genre && <span className="genre">Genre: {book.genre}</span>}</p>
                                    {book.publication_year && (
                                        <p>   <span className="year">Publication Year: {book.publication_year}</span></p>
                                    )}
                                    {book.isbn && <p>ISBN: {book.isbn}</p>}
                                </div>

                                <p className="availability">
                                    Available: {book.available_quantity}/{book.quantity}
                                </p>

                                {!isAvailable && (
                                    <div className="unavailable-badge">
                                        <i className="fas fa-times-circle"></i> Not available
                                    </div>
                                )}
                            </div>

                            {user && (
                                <button
                                    className={`borrow-btn ${!isAvailable ? 'disabled' : ''}`}
                                    onClick={() => handleBorrow(book.id)}
                                    disabled={!isAvailable}
                                >
                                    {isAvailable ? (
                                        <>
                                            <i className="fas fa-book-open"></i> Borrow
                                        </>
                                    ) : (
                                        'Unavailable'
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default Home;