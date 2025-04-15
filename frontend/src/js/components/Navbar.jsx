import { Link, useNavigate } from 'react-router-dom';
import '../../css/components/Navbar.css';

const Navbar = ({ user, setUser }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Library System</Link>
            </div>

            <div className="navbar-links">
                <Link to="/books" className="nav-link">Books</Link>

                {/* Явная ссылка на профиль */}
                {user && (
                    <Link to={`/profile/${user.id}`} className="nav-link">Profile</Link>
                )}

                {user?.role === 'admin' && (
                    <Link to="/admin" className="nav-link">
                        <i className="fas fa-cog"></i> Admin Panel
                    </Link>
                )}
            </div>

            <div className="navbar-user">
                {user ? (
                    <>
                        <div className="user-profile-link">
                            <Link to={`/profile/${user.id}`}>
                                <span className="user-avatar">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                                <span className="user-name">{user.name}</span>
                            </Link>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="logout-button"
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => navigate('/login')}
                            className="login-button"
                        >
                            Login
                        </button>
                    </>
                )}
            </div>
        </nav>
    );
};

export default Navbar;