import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../../css/components/BookFilters.css';

const BookFilters = ({ onSearch, onSort, showSort = true, initialSearch = '' }) => {
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [sortOption, setSortOption] = useState('title');

    // Sort options only when showSort=true
    const sortOptions = showSort ? [
        { value: 'title', label: 'By Title (A-Z)' },
        { value: 'title_desc', label: 'By Title (Z-A)' },
        { value: 'author', label: 'By Author (A-Z)' },
        { value: 'author_desc', label: 'By Author (Z-A)' },
        { value: 'available', label: 'By Availability (High-Low)' },
        { value: 'available_asc', label: 'By Availability (Low-High)' }
    ] : [];

    // Debounce for search (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                onSearch(searchTerm);
            } catch (err) {
                console.error('Search error:', err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm, onSearch]);

    // Sorting processing
    const handleSortChange = (option) => {
        try {
            setSortOption(option);
            if (onSort) onSort(option);
        } catch (err) {
            console.error('Sort error:', err);
        }
    };

    return (
        <div className="book-filters">
            {/* Search field*/}
            <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                    type="text"
                    placeholder={showSort ? "Search by title, author, genre, ISBN or year..." : "Search users..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search input"
                />
                {searchTerm && (
                    <button
                        className="clear-search"
                        onClick={() => setSearchTerm('')}
                        aria-label="Clear search"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                )}
            </div>

            {/* Sorting selector (books only) */}
            {showSort && sortOptions.length > 0 && (
                <div className="sort-controls">
                    <label htmlFor="sort-select">
                        <i className="fas fa-sort"></i> Sort:
                    </label>
                    <select
                        id="sort-select"
                        value={sortOption}
                        onChange={(e) => handleSortChange(e.target.value)}
                        aria-label="Sort options"
                    >
                        {sortOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

// Props check
BookFilters.propTypes = {
    onSearch: PropTypes.func.isRequired,
    onSort: PropTypes.func,
    showSort: PropTypes.bool,
    initialSearch: PropTypes.string
};

// Default values
BookFilters.defaultProps = {
    onSort: null,
    showSort: true,
    initialSearch: ''
};

export default BookFilters;