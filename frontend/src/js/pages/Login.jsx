import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../css/pages/Login.css';

const Login = ({ setUser }) => {
    const [isLoginForm, setIsLoginForm] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!isLoginForm) {
            if (!formData.name) {
                newErrors.name = 'Name is required';
            }

            if (!formData.confirmPassword) {
                newErrors.confirmPassword = 'Please confirm your password';
            } else if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);
        setErrors({});
        setSuccessMessage('');

        try {
            const endpoint = isLoginForm ? '/login' : '/register';
            const body = isLoginForm ? {
                email: formData.email,
                password: formData.password
            } : {
                name: formData.name,
                email: formData.email,
                password: formData.password
            };

            const response = await fetch(`http://localhost:5000/users${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            localStorage.setItem('token', data.token);
            setUser(data.user);

            if (!isLoginForm) {
                setSuccessMessage('Registration successful! You are now logged in.');
            }

            navigate('/');

        } catch (err) {
            setErrors({
                form: err.message || 'An error occurred during authentication'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h2>{isLoginForm ? 'Login' : 'Register'}</h2>

            {successMessage && (
                <div className="success-message">{successMessage}</div>
            )}

            {errors.form && (
                <div className="error-message">{errors.form}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                {!isLoginForm && (
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            disabled={loading}
                            className={errors.name ? 'input-error' : ''}
                        />
                        {errors.name && <span className="error">{errors.name}</span>}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        disabled={loading}
                        className={errors.email ? 'input-error' : ''}
                    />
                    {errors.email && <span className="error">{errors.email}</span>}
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        disabled={loading}
                        className={errors.password ? 'input-error' : ''}
                    />
                    {errors.password && <span className="error">{errors.password}</span>}
                </div>

                {!isLoginForm && (
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            disabled={loading}
                            className={errors.confirmPassword ? 'input-error' : ''}
                        />
                        {errors.confirmPassword && (
                            <span className="error">{errors.confirmPassword}</span>
                        )}
                    </div>
                )}

                <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading}
                >
                    {loading ? (
                        <span className="spinner"></span>
                    ) : isLoginForm ? (
                        'Login'
                    ) : (
                        'Register'
                    )}
                </button>
            </form>

            <div className="toggle-form">
                {isLoginForm ? "Don't have an account? " : "Already have an account? "}
                <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => {
                        setIsLoginForm(!isLoginForm);
                        setErrors({});
                        setSuccessMessage('');
                    }}
                    disabled={loading}
                >
                    {isLoginForm ? 'Register' : 'Login'}
                </button>
            </div>
        </div>
    );
};

export default Login;