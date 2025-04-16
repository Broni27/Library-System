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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Load profile data and loans
    useEffect(() => {
        let isMounted = true;

        const fetchProfileData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                // Get user profile
                const userResponse = await fetch('http://localhost:5000/users/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!userResponse.ok) throw new Error('Failed to load profile');

                const { user } = await userResponse.json();

                // Get user loans
                const loansResponse = await fetch(`http://localhost:5000/users/${user.id}/loans`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!loansResponse.ok) throw new Error('Failed to load loans');

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
                    console.error('Error loading profile:', err);
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        fetchProfileData();

        return () => { isMounted = false; };
    }, [id, navigate]);

    // Update profile
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
            if (!response.ok) throw new Error(data.error || 'Update failed');

            setUser(data.user);
            setProfileData(data.user);
            setIsEditing(false);
        } catch (err) {
            console.error('Update error:', err);
            setError(err.message);
        }
    };

    // Return a single book
    const handleReturnBook = async (loanId) => {
        try {
            setError(null);
            const token = localStorage.getItem('token');

            const response = await fetch(
                `http://localhost:5000/books/loans/${loanId}/return`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            if (!response.ok) throw new Error('Failed to return book');

            setLoans(prev => prev.map(loan =>
                loan.loan_id === loanId
                    ? { ...loan, is_returned: 1, status: 'returned' }
                    : loan
            ));
        } catch (err) {
            console.error('Return error:', err);
            setError(err.message);
        }
    };

    // Delete account and return all books
    const handleDeleteAccount = async () => {
        try {
            setIsDeleting(true);
            setDeleteError('');

            if (!profileData?.id) throw new Error('User not found');

            const token = localStorage.getItem('token');
            if (!token) throw new Error('Not authenticated');

            const response = await fetch(`http://localhost:5000/users/${profileData.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: deletePassword })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Deletion failed');

            // Success - logout and redirect
            localStorage.removeItem('token');
            setUser(null);
            navigate('/login', {
                state: {
                    message: `Account deleted. ${data.booksReturned || 0} books were returned.`
                }
            });
        } catch (err) {
            console.error('Delete error:', err);
            setDeleteError(err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading profile...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <h3>Error loading profile</h3>
                <p>{error}</p>
                <button
                    className="retry-button"
                    onClick={() => window.location.reload()}
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!profileData) {
        return (
            <div className="no-profile">
                <p>Profile not found</p>
                <button onClick={() => navigate('/login')}>Login</button>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="delete-modal-overlay">
                    <div className="delete-modal">
                        <h3>Delete Your Account</h3>
                        <p>
                            This will permanently delete your account and automatically return
                            all {loans.filter(l => l.status === 'active').length} borrowed books.
                        </p>

                        <div className="form-group">
                            <label>Enter your password to confirm:</label>
                            <input
                                type="password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                placeholder="Your password"
                            />
                        </div>

                        {deleteError && <div className="error-message">{deleteError}</div>}

                        <div className="modal-actions">
                            <button
                                className="cancel-delete-account-button"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeletePassword('');
                                    setDeleteError('');
                                }}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-button"
                                onClick={handleDeleteAccount}
                                disabled={!deletePassword || isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Permanently Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Section */}
            <section className="profile-section">
                <div className="profile-header">
                    <h2>My Profile</h2>
                    <div className="profile-actions">
                        {!isEditing ? (
                            <>
                                <button
                                    className="edit-button"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Edit Profile
                                </button>
                                <button
                                    className="delete-account-button"
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    Delete Account
                                </button>
                            </>
                        ) : (
                            <button
                                className="cancel-button"
                                onClick={() => setIsEditing(false)}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <form className="profile-form" onSubmit={handleUpdateProfile}>
                        {error && <div className="form-error">{error}</div>}

                        <div className="form-group">
                            <label>Full Name</label>
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

                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="Repeat new password"
                            />
                        </div>

                        <button type="submit" className="save-button">
                            Save Changes
                        </button>
                    </form>
                ) : (
                    <div className="profile-info">
                        <div className="info-row">
                            <span className="info-label">Name:</span>
                            <span className="info-value">{profileData.name}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email:</span>
                            <span className="info-value">{profileData.email}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Account Type:</span>
                            <span className="info-value">
                                {profileData.role === 'admin' ? 'Administrator' : 'Standard User'}
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* Loans Section */}
            <section className="loans-section">
                <h2>My Borrowed Books ({loans.length})</h2>

                {loans.length === 0 ? (
                    <p className="no-loans">You don't have any borrowed books</p>
                ) : (
                    <div className="loans-list">
                        {loans.map(loan => (
                            <div key={loan.loan_id} className={`loan-item ${loan.status}`}>
                                <div className="book-cover">
                                    {loan.cover_initials || `${loan.title.charAt(0)}${loan.author.charAt(0)}`}
                                </div>
                                <div className="loan-details">
                                    <h3>{loan.title}</h3>
                                    <p className="author">by {loan.author}</p>
                                    <div className="loan-meta">
                                        <span className={`status ${loan.status}`}>
                                            {loan.status === 'active'
                                                ? `Due: ${new Date(loan.due_date).toLocaleDateString()}`
                                                : loan.status === 'overdue'
                                                    ? `Overdue by ${Math.ceil(
                                                        (new Date() - new Date(loan.due_date)) /
                                                        (1000 * 60 * 60 * 24)
                                                    )} days`
                                                    : 'Returned'}
                                        </span>
                                    </div>
                                </div>
                                {loan.status === 'active' && (
                                    <button
                                        className="return-button"
                                        onClick={() => handleReturnBook(loan.loan_id)}
                                    >
                                        Return Book
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