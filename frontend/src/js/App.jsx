import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel'; // Import AdminPanel component
import '../css/App.css';

// Component for protecting routes with role verification
const RequireAuth = ({ children, role }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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
                    // Check user role
                    if (role && data.user.role !== role) {
                        navigate('/'); // Redirect to the main page if no access is available
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
                <p>Access Check...</p>
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

    // Исправленный useEffect
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

    // Error Handler
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

                    {/* New route for admin panel */}
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