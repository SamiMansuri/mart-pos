import React, { forwardRef } from 'react';

const SearchBar = forwardRef(({ onSearch }, ref) => {
  return (
    <div className="pos-card">
      <input 
        ref={ref}
        type="text" 
        placeholder="Search products by name or barcode... (F2 to focus)" 
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
