import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../../css/pages/Profile.css';

const Profile = ({ currentUser, updateUser }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: ''
    });

    // Загрузка данных профиля
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/users/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to fetch profile');

                setProfile(data.user);
                setFormData({
                    name: data.user.name,
                    email: data.user.email
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [id]);

    // Обработка изменения данных
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Отправка обновленных данных
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Update failed');

            setProfile(data.user);
            updateUser(data.user); // Обновляем данные в App.js
            setIsEditing(false);
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div className="loading">Loading profile...</div>;
    if (error) return <div className="error">Error: {error}</div>;

    return (
        <div className="profile-container">
            <div className="profile-header">
                <h2>User Profile</h2>
                {currentUser && currentUser.id === parseInt(id) && (
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="edit-button"
                    >
                        {isEditing ? 'Cancel' : 'Edit Profile'}
                    </button>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleSubmit} className="profile-form">
                    <div className="form-group">
                        <label>Name:</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Email:</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    {error && <div className="form-error">{error}</div>}
                    <button type="submit" className="save-button">Save Changes</button>
                </form>
            ) : (
                <div className="profile-info">
                    <div className="info-card">
                        <h3>Personal Information</h3>
                        <p><strong>Name:</strong> {profile.name}</p>
                        <p><strong>Email:</strong> {profile.email}</p>
                        <p><strong>Role:</strong> {profile.role}</p>
                        <p><strong>Member Since:</strong> {new Date(profile.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;