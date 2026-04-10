export interface IncomeFilter {
    // Date range
    startDate: string;
    endDate: string;
    
    // Account selection (empty array means all accounts)
    selectedAccounts: string[];
    
    // Tags selection (empty array means all tags)
    selectedTags: string[];
    
    // Sort options
    sortBy: 'none' | 'alphabetical' | 'amount';
    sortOrder: 'asc' | 'desc';
    
    // Search in transaction fields
    searchText: string;
    searchFields: {
        account: boolean;
        amount: boolean;
        date: boolean;
        time: boolean;
        category: boolean;
        comment: boolean;
    };
}
