import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel'; // Импортируем компонент AdminPanel
import '../css/App.css';

// Компонент для защиты маршрутов с проверкой роли
const RequireAuth = ({ children, role }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const response = await fetch('http://localhost:5000/users/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Session expired');
                }

                const data = await response.json();
                if (data.user) {
                    setUser(data.user);
                    // Проверяем роль пользователя
                    if (role && data.user.role !== role) {
                        navigate('/'); // Перенаправляем на главную, если нет доступа
                    }
                }
            } catch (err) {
                console.error('Auth check error:', err);
                localStorage.removeItem('token');
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [navigate, role]);

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Проверка доступа...</p>
            </div>
        );
    }

    return user ? children : <Navigate to="/login" />;
};

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // Проверка авторизации при загрузке приложения
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setLoading(false);
                    return;
                }

                const response = await fetch('http://localhost:5000/users/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Session expired');
                }

                const data = await response.json();
                if (data.user) {
                    setUser(data.user);
                    setError(null);
                }
            } catch (err) {
                console.error('Auth check error:', err);
                localStorage.removeItem('token');
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Обработчик ошибок
    const handleError = (err) => {
        console.error(err);
        setError(err.message);
        if (err.message.includes('Session expired')) {
            localStorage.removeItem('token');
            setUser(null);
        }
    };

    if (loading) {
        return (
            <div className="app-loading">
                <div className="spinner"></div>
                <p>Loading application...</p>
            </div>
        );
    }

    return (
        <div className="app">
            <Navbar user={user} setUser={setUser} onError={handleError} />

            <main className="main-content">
                {error && (
                    <div className="error-message">
                        {error}
                        <button onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                <Routes>
                    <Route path="/" element={<Home user={user} />} />

                    <Route
                        path="/login"
                        element={
                            user ? (
                                <Navigate to="/" />
                            ) : (
                                <Login
                                    setUser={setUser}
                                    onError={handleError}
                                />
                            )
                        }
                    />

                    <Route
                        path="/profile/:id"
                        element={
                            user ? (
                                <Profile
                                    currentUser={user}
                                    setUser={setUser}
                                    onError={handleError}
                                />
                            ) : (
                                <Navigate to="/login" />
                            )
                        }
                    />

                    {/* Новый маршрут для админ-панели */}
                    <Route
                        path="/admin"
                        element={
                            <RequireAuth role="admin">
                                <AdminPanel
                                    user={user}
                                    onError={handleError}
                                />
                            </RequireAuth>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;