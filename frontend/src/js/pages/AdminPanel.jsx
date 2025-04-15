import { useState, useEffect } from 'react';
import '../../css/pages/AdminPanel.css';

function AdminPanel() {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Формы
    const [newUserForm, setNewUserForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user'
    });

    const [bookForm, setBookForm] = useState({
        title: '',
        author: '',
        isbn: '',
        genre: '',
        quantity: 1
    });

    const [editingBook, setEditingBook] = useState(null);

    // Загрузка данных
    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else {
            fetchBooks();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setUsers(data.users);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchBooks = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/books?all=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setBooks(data.data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Обработчики форм
    const handleUserInputChange = (e) => {
        const { name, value } = e.target;
        setNewUserForm(prev => ({ ...prev, [name]: value }));
    };

    const handleBookInputChange = (e) => {
        const { name, value } = e.target;
        setBookForm(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/admin/register', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newUserForm)
            });

            if (!response.ok) throw new Error('Registration failed');

            setNewUserForm({
                name: '',
                email: '',
                password: '',
                role: 'user'
            });
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

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
                body: JSON.stringify(bookForm)
            });

            if (!response.ok) throw new Error(editingBook ? 'Update failed' : 'Creation failed');

            setBookForm({
                title: '',
                author: '',
                isbn: '',
                genre: '',
                quantity: 1
            });
            setEditingBook(null);
            fetchBooks();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Вы уверены, что хотите удалить пользователя?')) return;

        try {
            const response = await fetch(`http://localhost:5000/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Deletion failed');

            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEditBook = (book) => {
        setEditingBook(book);
        setBookForm({
            title: book.title,
            author: book.author,
            isbn: book.isbn || '',
            genre: book.genre || '',
            quantity: book.quantity
        });
    };

    const handleDeleteBook = async (bookId) => {
        if (!window.confirm('Вы уверены, что хотите удалить книгу?')) return;

        try {
            const response = await fetch(`http://localhost:5000/books/${bookId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Deletion failed');

            fetchBooks();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (error) {
        return (
            <div className="error">
                <p>{error}</p>
                <button onClick={() => setError(null)}>Close</button>
            </div>
        );
    }

    return (
        <div className="admin-panel">
            <div className="admin-tabs">
                <button
                    className={activeTab === 'users' ? 'active' : ''}
                    onClick={() => setActiveTab('users')}
                >
                    Управление пользователями
                </button>
                <button
                    className={activeTab === 'books' ? 'active' : ''}
                    onClick={() => setActiveTab('books')}
                >
                    Управление книгами
                </button>
            </div>

            {activeTab === 'users' ? (
                <div className="users-management">
                    <h2>Создать нового пользователя</h2>
                    <form onSubmit={handleCreateUser} className="user-form">
                        <div className="form-group">
                            <label>Имя:</label>
                            <input
                                type="text"
                                name="name"
                                value={newUserForm.name}
                                onChange={handleUserInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email:</label>
                            <input
                                type="email"
                                name="email"
                                value={newUserForm.email}
                                onChange={handleUserInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Пароль:</label>
                            <input
                                type="password"
                                name="password"
                                value={newUserForm.password}
                                onChange={handleUserInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Роль:</label>
                            <select
                                name="role"
                                value={newUserForm.role}
                                onChange={handleUserInputChange}
                            >
                                <option value="user">Пользователь</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                        <button type="submit" className="submit-btn">
                            Создать пользователя
                        </button>
                    </form>

                    <h2>Список пользователей</h2>
                    <div className="users-list">
                        {users.map(user => (
                            <div key={user.id} className="user-card">
                                <div className="user-info">
                                    <h3>{user.name}</h3>
                                    <p>Email: {user.email}</p>
                                    <p>Роль: {user.role === 'admin' ? 'Администратор' : 'Пользователь'}</p>
                                </div>
                                <button
                                    className="delete-btn"
                                    onClick={() => handleDeleteUser(user.id)}
                                >
                                    Удалить
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="books-management">
                    <h2>{editingBook ? 'Редактировать книгу' : 'Добавить новую книгу'}</h2>
                    <form onSubmit={handleCreateBook} className="book-form">
                        <div className="form-group">
                            <label>Название:</label>
                            <input
                                type="text"
                                name="title"
                                value={bookForm.title}
                                onChange={handleBookInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Автор:</label>
                            <input
                                type="text"
                                name="author"
                                value={bookForm.author}
                                onChange={handleBookInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>ISBN:</label>
                            <input
                                type="text"
                                name="isbn"
                                value={bookForm.isbn}
                                onChange={handleBookInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Жанр:</label>
                            <input
                                type="text"
                                name="genre"
                                value={bookForm.genre}
                                onChange={handleBookInputChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>Количество:</label>
                            <input
                                type="number"
                                name="quantity"
                                value={bookForm.quantity}
                                onChange={handleBookInputChange}
                                min="1"
                                required
                            />
                        </div>
                        <button type="submit" className="submit-btn">
                            {editingBook ? 'Обновить книгу' : 'Добавить книгу'}
                        </button>
                        {editingBook && (
                            <button
                                type="button"
                                className="cancel-btn"
                                onClick={() => setEditingBook(null)}
                            >
                                Отмена
                            </button>
                        )}
                    </form>

                    <h2>Список книг</h2>
                    <div className="books-list">
                        {books.map(book => (
                            <div key={book.id} className="book-card">
                                <div className="book-info">
                                    <h3>{book.title}</h3>
                                    <p>Автор: {book.author}</p>
                                    <p>Жанр: {book.genre || 'Не указан'}</p>
                                    <p>Доступно: {book.available_quantity}/{book.quantity}</p>
                                </div>
                                <div className="book-actions">
                                    <button
                                        className="edit-btn"
                                        onClick={() => handleEditBook(book)}
                                    >
                                        Редактировать
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDeleteBook(book.id)}
                                    >
                                        Удалить
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;