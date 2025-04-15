import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../css/pages/Profile.css';

function Profile({ currentUser, setUser }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profileData, setProfileData] = useState(null);
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

    // Загрузка данных профиля и книг
    useEffect(() => {
        let isMounted = true;

        const fetchProfileData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                // Загрузка данных пользователя
                const userResponse = await fetch('http://localhost:5000/users/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!userResponse.ok) {
                    throw new Error(`Ошибка загрузки профиля: ${userResponse.status}`);
                }

                const { user } = await userResponse.json();

                // Загрузка списка книг
                const loansResponse = await fetch(`http://localhost:5000/users/${user.id}/loans`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!loansResponse.ok) {
                    throw new Error(`Ошибка загрузки книг: ${loansResponse.status}`);
                }

                const { loans } = await loansResponse.json();

                if (isMounted) {
                    setProfileData(user);
                    setLoans(loans || []);
                    setFormData({
                        name: user.name,
                        email: user.email,
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                    });
                    setLoading(false);
                }

            } catch (err) {
                if (isMounted) {
                    console.error('Ошибка загрузки:', err);
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        fetchProfileData();

        return () => {
            isMounted = false;
        };
    }, [id, navigate]);

    // Обновление профиля
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            setError(null);
            const token = localStorage.getItem('token');

            const response = await fetch(`http://localhost:5000/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка обновления');

            setUser(data.user);
            setProfileData(data.user);
            setIsEditing(false);
        } catch (err) {
            console.error('Ошибка обновления:', err);
            setError(err.message);
        }
    };

    // Возврат книги
    const handleReturnBook = async (loanId) => {
        try {
            setError(null);
            const token = localStorage.getItem('token');

            const response = await fetch(
                `http://localhost:5000/books/loans/${loanId}/return`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) throw new Error('Ошибка возврата книги');

            setLoans(prevLoans =>
                prevLoans.map(loan =>
                    loan.loan_id === loanId
                        ? { ...loan, is_returned: 1, status: 'returned' }
                        : loan
                )
            );
        } catch (err) {
            console.error('Ошибка возврата:', err);
            setError(err.message);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Загрузка данных профиля...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <h3>Произошла ошибка</h3>
                <p>{error}</p>
                <button
                    className="retry-button"
                    onClick={() => window.location.reload()}
                >
                    Попробовать снова
                </button>
            </div>
        );
    }

    if (!profileData) {
        return (
            <div className="no-data">
                <p>Данные профиля не найдены</p>
                <button onClick={() => navigate('/login')}>Войти</button>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {/* Секция профиля */}
            <section className="profile-section">
                <div className="profile-header">
                    <h2>Ваш профиль</h2>
                    {!isEditing ? (
                        <button
                            className="edit-button"
                            onClick={() => setIsEditing(true)}
                        >
                            Редактировать
                        </button>
                    ) : (
                        <button
                            className="cancel-button"
                            onClick={() => setIsEditing(false)}
                        >
                            Отмена
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form className="profile-form" onSubmit={handleUpdateProfile}>
                        {error && <div className="form-error">{error}</div>}

                        <div className="form-group">
                            <label>Имя</label>
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
                            <label>Текущий пароль</label>
                            <input
                                type="password"
                                name="currentPassword"
                                value={formData.currentPassword}
                                onChange={handleInputChange}
                                placeholder="Требуется для изменений"
                            />
                        </div>

                        <div className="form-group">
                            <label>Новый пароль</label>
                            <input
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                placeholder="Оставьте пустым, если не меняется"
                            />
                        </div>

                        <div className="form-group">
                            <label>Подтвердите пароль</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="Повторите новый пароль"
                            />
                        </div>

                        <button type="submit" className="save-button">
                            Сохранить изменения
                        </button>
                    </form>
                ) : (
                    <div className="profile-info">
                        <div className="info-row">
                            <span className="info-label">Имя:</span>
                            <span className="info-value">{profileData.name}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email:</span>
                            <span className="info-value">{profileData.email}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Роль:</span>
                            <span className="info-value">
                                {profileData.role === 'admin' ? 'Администратор' : 'Пользователь'}
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* Секция книг */}
            <section className="loans-section">
                <h2>Ваши книги ({loans.length})</h2>

                {loans.length === 0 ? (
                    <p className="no-loans">У вас нет взятых книг</p>
                ) : (
                    <div className="loans-list">
                        {loans.map(loan => (
                            <div key={loan.loan_id} className={`loan-item ${loan.status}`}>
                                <div className="book-cover">
                                    {loan.cover_initials || `${loan.title?.charAt(0)}${loan.author?.charAt(0)}`}
                                </div>
                                <div className="loan-info">
                                    <h3>{loan.title || 'Неизвестная книга'}</h3>
                                    <p className="loan-author">Автор: {loan.author || 'Неизвестен'}</p>
                                    <div className="loan-meta">
                                        <span className={`status ${loan.status}`}>
                                            {loan.status === 'active' ? 'На руках' :
                                                loan.status === 'overdue' ? 'Просрочена' : 'Возвращена'}
                                        </span>
                                        <span className="due-date">
                                            Срок: {new Date(loan.due_date).toLocaleDateString('ru-RU')}
                                        </span>
                                        {loan.status === 'overdue' && (
                                            <span className="days-overdue">
                                                Просрочено на {Math.ceil((new Date() - new Date(loan.due_date)) / (1000 * 60 * 60 * 24))} дней
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {loan.status === 'active' && (
                                    <button
                                        className="return-button"
                                        onClick={() => handleReturnBook(loan.loan_id)}
                                    >
                                        Вернуть
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