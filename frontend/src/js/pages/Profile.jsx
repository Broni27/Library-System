import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../../css/pages/Profile.css';

function Profile({ currentUser, setUser }) {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const { id } = useParams();

    // Загрузка данных при монтировании
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Проверяем, что currentUser загружен
                if (!currentUser) {
                    throw new Error('User data not loaded');
                }

                // Устанавливаем данные формы
                setFormData({
                    name: currentUser.name || '',
                    email: currentUser.email || '',
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });

                // Загружаем займы
                const loansResponse = await fetch(
                    `http://localhost:5000/users/${id}/loans`,
                    {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    }
                );

                if (!loansResponse.ok) {
                    throw new Error('Failed to load loans');
                }

                const loansData = await loansResponse.json();
                setLoans(loansData.loans || []);

            } catch (err) {
                console.error('Error loading profile data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, currentUser]);

    const handleReturnBook = async (bookId) => {
        try {
            setError(null);

            const response = await fetch(
                `http://localhost:5000/books/${bookId}/return`,
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
                throw new Error(result.error || 'Return failed');
            }

            // Обновляем список займов
            const updatedLoans = loans.filter(loan => loan.book_id !== bookId);
            setLoans(updatedLoans);

        } catch (err) {
            console.error('Return error:', err);
            setError(err.message);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError(null);

            if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
                throw new Error('New passwords do not match');
            }

            const response = await fetch(
                `http://localhost:5000/users/${id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        currentPassword: formData.currentPassword,
                        newPassword: formData.newPassword
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Update failed');
            }

            // Обновляем данные пользователя
            if (setUser) {
                setUser(data.user);
            }

            setIsEditing(false);

        } catch (err) {
            console.error('Update error:', err);
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="loading">Loading profile data...</div>;
    }

    if (error) {
        return (
            <div className="error">
                Error: {error}
                <button onClick={() => window.location.reload()}>Refresh</button>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {/* Секция профиля */}
            <section className="profile-section">
                <div className="profile-header">
                    <h2>Your Profile</h2>
                    {!isEditing ? (
                        <button
                            className="edit-button"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit Profile
                        </button>
                    ) : (
                        <button
                            className="cancel-button"
                            onClick={() => setIsEditing(false)}
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form className="profile-form" onSubmit={handleSubmit}>
                        {error && <div className="form-error">{error}</div>}

                        <div className="form-group">
                            <label>Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Current Password</label>
                            <input
                                type="password"
                                name="currentPassword"
                                value={formData.currentPassword}
                                onChange={handleInputChange}
                                placeholder="Required for changes"
                            />
                        </div>

                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                placeholder="Leave blank to keep current"
                            />
                        </div>

                        {formData.newPassword && (
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    required={!!formData.newPassword}
                                />
                            </div>
                        )}

                        <button type="submit" className="save-button">
                            Save Changes
                        </button>
                    </form>
                ) : (
                    <div className="profile-info">
                        <div className="info-row">
                            <span className="info-label">Name:</span>
                            <span className="info-value">{currentUser?.name || 'Not available'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email:</span>
                            <span className="info-value">{currentUser?.email || 'Not available'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Role:</span>
                            <span className="info-value">{currentUser?.role || 'User'}</span>
                        </div>
                    </div>
                )}
            </section>

            {/* Секция займов */}
            <section className="loans-section">
                <h2>Your Borrowed Books</h2>

                {loans.length === 0 ? (
                    <p className="no-loans">No books borrowed yet.</p>
                ) : (
                    <div className="loans-list">
                        {loans.map(loan => (
                            <div key={loan.loan_id} className="loan-item">
                                <div className="book-cover">
                                    {loan.cover_initials ||
                                        `${loan.title?.charAt(0)}${loan.author?.charAt(0)}`}
                                </div>
                                <div className="loan-info">
                                    <h3>{loan.title || 'Unknown book'}</h3>
                                    <p>by {loan.author || 'Unknown author'}</p>
                                    <div className="loan-meta">
                                        <span className={`status ${loan.status?.toLowerCase()}`}>
                                            {loan.status || 'Active'}
                                        </span>
                                        <span>Due: {loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'Not specified'}</span>
                                        {loan.days_remaining && loan.status === 'Active' && (
                                            <span>Days left: {loan.days_remaining}</span>
                                        )}
                                    </div>
                                </div>
                                {loan.status === 'Active' && (
                                    <button
                                        className="return-button"
                                        onClick={() => handleReturnBook(loan.book_id)}
                                    >
                                        Return
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Profile;