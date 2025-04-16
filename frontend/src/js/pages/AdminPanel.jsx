import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BookFilters from '../components/BookFilters';
import '../../css/pages/AdminPanel.css';

function AdminPanel({ user }) {
    const [activeTab, setActiveTab] = useState('books');
    const [allBooks, setAllBooks] = useState([]);
    const [displayedBooks, setDisplayedBooks] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [displayedUsers, setDisplayedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('title');

    // Book form with new fields
    const [bookForm, setBookForm] = useState({
        title: '',
        author: '',
        isbn: '',
        genre: '',
        publication_year: '',
        quantity: 1
    });

    const [userForm, setUserForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user'
    });

    const [editingBook, setEditingBook] = useState(null);
    const navigate = useNavigate();

    // Check administrator rights
    useEffect(() => {
        if (user?.role !== 'admin') {
            navigate('/');
        }
    }, [user, navigate]);

    // Loading data
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const [booksRes, usersRes] = await Promise.all([
                    fetch('http://localhost:5000/books?all=true', {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    }),
                    fetch('http://localhost:5000/admin/users', {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    })
                ]);

                if (!booksRes.ok) throw new Error('Failed to load books');
                if (!usersRes.ok) throw new Error('Failed to load users');

                const booksData = await booksRes.json();
                const usersData = await usersRes.json();

                setAllBooks(booksData.data || []);
                setDisplayedBooks(booksData.data || []);
                setAllUsers(usersData.users || []);
                setDisplayedUsers(usersData.users || []);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filtering and sorting functions
    const filterBooks = useCallback((term, option) => {
        let filtered = [...allBooks];

        if (term) {
            const searchTerm = term.toLowerCase();
            filtered = filtered.filter(book =>
                book.title?.toLowerCase().includes(searchTerm) ||
                book.author?.toLowerCase().includes(searchTerm) ||
                book.genre?.toLowerCase().includes(searchTerm) ||
                book.isbn?.toLowerCase().includes(searchTerm) ||
                String(book.publication_year)?.includes(searchTerm)
            );
        }

        switch(option) {
            case 'title':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'title_desc':
                filtered.sort((a, b) => b.title.localeCompare(a.title));
                break;
            case 'author':
                filtered.sort((a, b) => a.author.localeCompare(b.author));
                break;
            default:
                break;
        }

        setDisplayedBooks(filtered);
    }, [allBooks]);

    const filterUsers = useCallback((term) => {
        if (!term) {
            setDisplayedUsers(allUsers);
            return;
        }

        const searchTerm = term.toLowerCase();
        const filtered = allUsers.filter(user =>
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm)
        );

        setDisplayedUsers(filtered);
    }, [allUsers]);

    // Filter handlers
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
        if (activeTab === 'books') {
            filterBooks(term, sortOption);
        } else {
            filterUsers(term);
        }
    }, [activeTab, filterBooks, filterUsers, sortOption]);

    const handleSort = useCallback((option) => {
        setSortOption(option);
        if (activeTab === 'books') {
            filterBooks(searchTerm, option);
        }
    }, [activeTab, filterBooks, searchTerm]);

    // CRUD operations for books
    const handleCreateBook = async (e) => {
        e.preventDefault();
        try {
            const url = editingBook
                ? `http://localhost:5000/books/${editingBook.id}`
                : 'http://localhost:5000/books';

            const method = editingBook ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...bookForm,
                    publication_year: bookForm.publication_year || null,
                    genre: bookForm.genre || null,
                    isbn: bookForm.isbn || null
                })
            });

            if (!response.ok) throw new Error(editingBook ? 'Update failed' : 'Creation failed');

            const result = await response.json();
            const updatedBooks = editingBook
                ? allBooks.map(b => b.id === editingBook.id ? result.book : b)
                : [...allBooks, result.book];

            setAllBooks(updatedBooks);
            filterBooks(searchTerm, sortOption);

            setBookForm({
                title: '',
                author: '',
                isbn: '',
                genre: '',
                publication_year: '',
                quantity: 1
            });
            setEditingBook(null);

        } catch (err) {
            setError(err.message);
        }
    };

    // CRUD operations for users
    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/admin/register', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userForm)
            });

            if (!response.ok) throw new Error('Registration failed');

            const updatedUsers = [...allUsers, userForm];

            setAllUsers(updatedUsers);
            filterUsers(searchTerm);

            setUserForm({
                name: '',
                email: '',
                password: '',
                role: 'user'
            });

        } catch (err) {
            setError(err.message);
        }
    };

    // Deleting a book
    const handleDeleteBook = async (bookId) => {
        if (!window.confirm('Are you sure you want to delete this book?')) return;

        try {
            const response = await fetch(`http://localhost:5000/books/${bookId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Delete failed');

            const updatedBooks = allBooks.filter(book => book.id !== bookId);
            setAllBooks(updatedBooks);
            filterBooks(searchTerm, sortOption);
        } catch (err) {
            setError(err.message);
        }
    };

    // Deleting a user
    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await fetch(`http://localhost:5000/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Delete failed');

            const updatedUsers = allUsers.filter(user => user.id !== userId);
            setAllUsers(updatedUsers);
            filterUsers(searchTerm);
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="admin-loading">Loading admin data...</div>;
    }

    if (error) {
        return (
            <div className="admin-error">
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            <BookFilters
                onSearch={handleSearch}
                onSort={activeTab === 'books' ? handleSort : undefined}
                showSort={activeTab === 'books'}
            />

            <div className="admin-tabs">
                <button
                    className={activeTab === 'books' ? 'active' : ''}
                    onClick={() => setActiveTab('books')}
                >
                    Manage Books
                </button>
                <button
                    className={activeTab === 'users' ? 'active' : ''}
                    onClick={() => setActiveTab('users')}
                >
                    Manage Users
                </button>
            </div>

            {activeTab === 'books' ? (
                <div className="admin-content">
                    <form onSubmit={handleCreateBook} className="admin-form">
                        <h2>{editingBook ? 'Edit Book' : 'Add New Book'}</h2>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Title*:</label>
                                <input
                                    type="text"
                                    value={bookForm.title}
                                    onChange={(e) => setBookForm({...bookForm, title: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Author*:</label>
                                <input
                                    type="text"
                                    value={bookForm.author}
                                    onChange={(e) => setBookForm({...bookForm, author: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>ISBN:</label>
                                <input
                                    type="text"
                                    value={bookForm.isbn}
                                    onChange={(e) => setBookForm({...bookForm, isbn: e.target.value})}
                                    placeholder="Optional"
                                />
                            </div>

                            <div className="form-group">
                                <label>Genre:</label>
                                <input
                                    type="text"
                                    value={bookForm.genre}
                                    onChange={(e) => setBookForm({...bookForm, genre: e.target.value})}
                                    placeholder="Optional"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Publication Year:</label>
                                <input
                                    type="number"
                                    min="1900"
                                    max={new Date().getFullYear()}
                                    value={bookForm.publication_year}
                                    onChange={(e) => setBookForm({...bookForm, publication_year: e.target.value})}
                                    placeholder="YYYY"
                                />
                            </div>

                            <div className="form-group">
                                <label>Quantity*:</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={bookForm.quantity}
                                    onChange={(e) => setBookForm({...bookForm, quantity: e.target.value})}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="submit-btn">
                                {editingBook ? 'Update Book' : 'Add Book'}
                            </button>

                            {editingBook && (
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setEditingBook(null)}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>

                    <h2>Books ({displayedBooks.length})</h2>
                    <div className="admin-books-grid">
                        {displayedBooks.map(book => (
                            <div key={book.id} className="admin-book-card">
                                <div className="book-header">
                                    <h3>{book.title}</h3>
                                    <p className="author">by {book.author}</p>
                                </div>

                                <div className="book-details">
                                    {book.isbn && <p><strong>ISBN:</strong> {book.isbn}</p>}
                                    {book.genre && <p><strong>Genre:</strong> {book.genre}</p>}
                                    {book.publication_year && (
                                        <p><strong>Year:</strong> {book.publication_year}</p>
                                    )}
                                    <p><strong>Available:</strong> {book.available_quantity}/{book.quantity}</p>
                                </div>

                                <div className="book-actions">
                                    <button
                                        className="edit-btn"
                                        onClick={() => {
                                            setEditingBook(book);
                                            setBookForm({
                                                title: book.title,
                                                author: book.author,
                                                isbn: book.isbn || '',
                                                genre: book.genre || '',
                                                publication_year: book.publication_year || '',
                                                quantity: book.quantity
                                            });
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDeleteBook(book.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="admin-content">
                    <form onSubmit={handleCreateUser} className="admin-form">
                        <h2>Add New User</h2>

                        <div className="form-group">
                            <label>Name*:</label>
                            <input
                                type="text"
                                value={userForm.name}
                                onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Email*:</label>
                            <input
                                type="email"
                                value={userForm.email}
                                onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Password*:</label>
                            <input
                                type="password"
                                value={userForm.password}
                                onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Role:</label>
                            <select
                                value={userForm.role}
                                onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <button type="submit" className="submit-btn">
                            Add User
                        </button>
                    </form>

                    <h2>Users ({displayedUsers.length})</h2>
                    <div className="users-grid">
                        {displayedUsers.map(user => {if(user !== undefined){
                            return (<div key={user.id} className="admin-card">
                                <div className="card-content">
                                    <h3>{user.name}</h3>
                                    <p>Email: {user.email}</p>
                                    <p>Role: {user.role}</p>
                                </div>
                                <div className="card-actions">
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDeleteUser(user.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>)
                        }}

                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;