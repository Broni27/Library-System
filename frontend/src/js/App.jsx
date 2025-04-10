import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // Импортируем только необходимые компоненты
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import '../css/App.css';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        fetch('http://localhost:5000/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUser(data.user);
                }
                setLoading(false);
            })
            .catch(() => {
                localStorage.removeItem('token');
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="app-loading">Loading application...</div>;
    }

    return (
        // УБРАНА обертка в <Router> - он уже есть в main.jsx
        <div className="app">
            <Navbar user={user} setUser={setUser} />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Home user={user} />} />
                    <Route path="/login" element={<Login setUser={setUser} />} />
                    <Route
                        path="/profile/:id"
                        element={user ? <Profile currentUser={user} /> : <Navigate to="/login" />}
                    />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;