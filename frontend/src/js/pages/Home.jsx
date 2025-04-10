import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/pages/Home.css';

const Home = ({ user }) => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBooks = async () => {
            console.log('Начало загрузки книг...');
            try {
                const response = await fetch('http://localhost:5000/books');
                console.log('Ответ сервера:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                console.log('Получены книги:', data);

                if (!data || data.length === 0) {
                    throw new Error('No books found in database');
                }

                setBooks(data);
                setError(null);
            } catch (err) {
                console.error('Ошибка загрузки:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchBooks();
    }, []);

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
                <h3>Error loading books</h3>
                <p>{error}</p>
                <button
                    className="retry-btn"
                    onClick={() => window.location.reload()}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="home">
            <h1>Library Collection</h1>
            {user && <p>Welcome, {user.name}!</p>}

            <div className="books-grid">
                {books.map(book => (
                    <div key={book.id} className="book-card">
                        <div className="book-cover">
                            {book.title.split(' ').map(w => w[0]).join('')}
                        </div>
                        <h3>{book.title}</h3>
                        <p className="author">{book.author}</p>
                        <p className="quantity">
                            Available: {book.available_quantity}/{book.quantity}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Home;