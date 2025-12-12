import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, FileText, Loader, GitCompare, Minus, Plus, Search, CheckCircle, Scroll } from 'lucide-react';

// NOTE: Gemini API utilities are kept for future expansion but the bio generation is removed.
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent";
const API_KEY = ""; // Placeholder for Canvas runtime environment

// --- GEDCOM Utility Functions ---

/**
 * A simplified function to parse GEDCOM text into an array of person objects.
 * This function handles the most basic INDI, NAME, BIRT, DATE, and PLAC tags.
 * @param {string} gedcomText The full text content of the GEDCOM file.
 * @returns {Array<Object>} An array of parsed individual records.
 */
const parseGedcom = (gedcomText) => {
  const lines = gedcomText.split('\n');
  const people = {};
  let currentPersonId = null;
  let currentBirthDetails = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 1. REGEX for Level 0 INDI records (e.g., 0 @I123@ INDI)
    const indiMatch = line.match(/^0\s+@(\w+)@\s+INDI$/);
    
    if (indiMatch) {
      currentPersonId = indiMatch[1];
      people[currentPersonId] = {
        id: currentPersonId, // Keep original GEDCOM ID for map key
        name: 'Unknown Individual',
        details: {},
      };
      currentBirthDetails = null; // Reset nested state
      continue;
    } 

    // 2. REGEX for Level 1+ detail records (e.g., 1 NAME John /Doe/, 2 DATE 1900)
    const detailMatch = line.match(/^(\d)\s+(\w+)\s*(.*)$/);

    if (currentPersonId && detailMatch) {
      const [_, levelStr, tag, value] = detailMatch;
      const level = parseInt(levelStr, 10);
      const trimmedValue = value.trim();
      const person = people[currentPersonId];

      if (level === 1 && tag === 'NAME') {
        // 1 NAME Given /Surname/
        person.name = trimmedValue.replace(/\//g, '').trim();
      } else if (level === 1 && tag === 'SEX') {
        // 1 SEX M/F
        person.details.Sex = trimmedValue;
      } else if (level === 1 && tag === 'BIRT') {
        // 1 BIRT (Expect 2 DATE and 2 PLAC next)
        person.details.Birth = { date: 'Unknown', place: 'Unknown' };
        currentBirthDetails = person.details.Birth;
      } else if (level === 2 && tag === 'DATE' && currentBirthDetails) {
        // 2 DATE 1 Jan 1900
        currentBirthDetails.date = trimmedValue;
      } else if (level === 2 && tag === 'PLAC' && currentBirthDetails) {
        // 2 PLAC London, England
        currentBirthDetails.place = trimmedValue;
      }
    }
  }

  return Object.values(people);
};


/**
 * Helper to create a consistent, human-meaningful key for comparison.
 * This key is used instead of the GEDCOM ID to determine if two records represent the same person.
 */
const createComparisonKey = (person) => {
    // Standardize and concatenate key fields: Name, Sex, Birth Date, Birth Place
    const name = person.name ? person.name.toUpperCase().replace(/[^A-Z]/g, '') : '';
    const sex = person.details.Sex ? person.details.Sex.toUpperCase() : '';
    const birthDate = person.details.Birth?.date ? person.details.Birth.date.toUpperCase() : '';
    // Simplify place by removing spaces/special chars for robust matching
    const birthPlace = person.details.Birth?.place ? person.details.Birth.place.toUpperCase().replace(/[^A-Z]/g, '') : '';

    return `${name}|${sex}|${birthDate}|${birthPlace}`;
};


/**
 * Compares two arrays of people based on their human-meaningful details (ignoring GEDCOM ID).
 * Returns status maps keyed by the original GEDCOM ID.
 *
 * @param {Array<Object>} peopleA Data from the first file.
 * @param {Array<Object>} peopleB Data from the second file.
 * @returns {Object} { statusMapA: Map<ID, string>, statusMapB: Map<ID, string>, counts: Object }
 */
const compareGedcomData = (peopleA, peopleB) => {
    // Map 1: Composite Key -> Array of people with that key (to handle data duplicates within a file)
    const keyMapA = new Map();
    peopleA.forEach(p => {
        const key = createComparisonKey(p);
        if (!keyMapA.has(key)) keyMapA.set(key, []);
        keyMapA.get(key).push(p);
    });

    const keyMapB = new Map();
    peopleB.forEach(p => {
        const key = createComparisonKey(p);
        if (!keyMapB.has(key)) keyMapB.set(key, []);
        keyMapB.get(key).push(p);
    });

    const statusMapA = new Map();
    const statusMapB = new Map();

    const counts = {
        UNIQUE_A: 0, // Unique based on human details
        UNIQUE_B: 0, // Unique based on human details
        MATCH: 0,    // Identical match based on human details
    };
    
    // 1. Determine status for all unique keys found across both files
    const allKeys = new Set([...keyMapA.keys(), ...keyMapB.keys()]);

    for (const key of allKeys) {
        const recordsA = keyMapA.get(key) || [];
        const recordsB = keyMapB.get(key) || [];

        let status;
        if (recordsA.length > 0 && recordsB.length > 0) {
            // Found in both files based on human data. This is now a MATCH (Green).
            status = 'MATCH';
            // Count the number of original GEDCOM IDs associated with this matched key in both files
            counts.MATCH += recordsA.length + recordsB.length; 
        } else if (recordsA.length > 0) {
            // Unique key to File A.
            status = 'UNIQUE_A';
            counts.UNIQUE_A += recordsA.length;
        } else if (recordsB.length > 0) {
            // Unique key to File B.
            status = 'UNIQUE_B';
            counts.UNIQUE_B += recordsB.length;
        }
        
        // 2. Map the status back to the original GEDCOM IDs for display
        recordsA.forEach(p => statusMapA.set(p.id, status));
        recordsB.forEach(p => statusMapB.set(p.id, status));
    }

    return { statusMapA, statusMapB, counts };
};


// --- Accordion Item Component (Simplified) ---

const AccordionItem = React.memo(({ person, comparisonStatus }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Helper function to render a simple key-value list of details
  const renderDetails = (details) => {
    return (
      <ul className="space-y-1 text-sm text-gray-700 p-2">
        {Object.entries(details).map(([key, value]) => (
          <li key={key} className="flex justify-between items-start border-b border-gray-100 pb-1 last:border-b-0">
            <span className="font-semibold text-gray-600">{key}:</span>
            <span className="text-right">
              {typeof value === 'object' && value !== null ? (
                <>
                  {value.date && <div className="font-medium">{value.date}</div>}
                  {value.place && <div className="text-xs italic text-gray-500">{value.place}</div>}
                </>
              ) : (
                value
              )}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  // Determine styling and icon based on comparison status
  let uniqueClass = 'bg-white border-gray-200 hover:bg-gray-50';
  let statusIcon = null;

  switch (comparisonStatus) {
    case 'UNIQUE_A':
    case 'UNIQUE_B':
      // Red for entries unique to this file
      uniqueClass = 'bg-red-100 border-red-400 hover:bg-red-200';
      statusIcon = <Minus className="w-4 h-4 mr-2 text-red-600 inline" title="Unique Entry" />;
      break;
    case 'MATCH':
      // Green for identical match on human details
      uniqueClass = 'bg-green-100 border-green-400 hover:bg-green-200';
      statusIcon = <CheckCircle className="w-4 h-4 mr-2 text-green-600 inline" title="Identical Match" />;
      break;
    default:
      // Default state before comparison is run
      statusIcon = <Search className="w-4 h-4 mr-2 text-gray-400 inline" title="No Comparison" />;
      break;
  }


  return (
    <div className={`rounded-lg shadow-sm transition-all duration-300 border ${uniqueClass}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-3 text-left font-medium text-gray-800 transition duration-150 rounded-lg"
        aria-expanded={isOpen}
      >
        <span className="text-lg truncate">
          {statusIcon}
          {person.name} <span className="text-sm text-gray-500 font-normal">(ID: {person.id})</span>
        </span>
        <ChevronDown 
          className={`h-5 w-5 text-indigo-500 transition-transform duration-300 ${isOpen ? 'transform rotate-180' : ''}`} 
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          isOpen ? 'max-h-[1000px] opacity-100 p-4 pt-0' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-gray-100 pt-4">
          {Object.keys(person.details).length > 0 ? (
            renderDetails(person.details)
          ) : (
            <p className="text-sm text-gray-500 italic p-2">
              No detailed records (Birth/Death/Sex) parsed for this individual.
            </p>
          )}
        </div>
      </div>
    </div>
  );
});


// --- File Tree List Component (New) ---

const FileTreeList = ({ people, fileName, fileIndex, comparisonResults, comparisonActive, scrollRef, onScroll }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPeople = people.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatus = (personId) => {
        if (!comparisonActive || !comparisonResults) return 'NONE';
        
        // File 1 uses statusMapA, File 2 uses statusMapB
        const statusMap = fileIndex === 1 ? comparisonResults.statusMapA : comparisonResults.statusMapB;
        return statusMap.get(personId) || 'NONE'; 
    };

    return (
        <div className="space-y-4 bg-white p-5 rounded-xl shadow-lg border border-indigo-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center justify-between">
                <div>
                    <FileText className="w-5 h-5 mr-2 inline text-indigo-500" />
                    Individuals in File {fileIndex}: {fileName || 'N/A'} 
                </div>
                <span className="text-base font-normal text-indigo-600">({people.length} Records)</span>
            </h2>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder={`Search ${fileName || 'records'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                />
            </div>

            {/* List Container - Scrollable Area */}
            <div 
                ref={scrollRef}
                onScroll={onScroll}
                // Setting max-h-screen for better scrolling experience on large monitors
                className="space-y-2 max-h-[70vh] xl:max-h-[80vh] overflow-y-auto pr-2"
            >
                {filteredPeople.length > 0 ? (
                    filteredPeople.map(person => (
                        <AccordionItem 
                            key={person.id} 
                            person={person} 
                            comparisonStatus={getStatus(person.id)} 
                        />
                    ))
                ) : (
                    <p className="text-center py-4 text-gray-500 italic">
                        {people.length === 0 ? "No records loaded." : "No matching records found."}
                    </p>
                )}
            </div>
        </div>
    );
};


// --- Comparison Display Component ---

const ComparisonResults = ({ comparisonResults, file1Name, file2Name }) => {
    const { counts } = comparisonResults;
    // Total records counts the original GEDCOM IDs, which may be more than the number of unique comparison keys
    const totalRecords = counts.MATCH + counts.UNIQUE_A + counts.UNIQUE_B;
    const totalUnique = counts.UNIQUE_A + counts.UNIQUE_B;


    if (totalUnique === 0 && totalRecords > 0) {
        return (
            <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded-xl mb-6 shadow-md flex items-center justify-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                <p className="font-semibold">All {counts.MATCH} records based on Name, Sex, and Birth details match across both files!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <GitCompare className="w-6 h-6 mr-2 text-indigo-600" />
                Comparison Summary (Based on Human-Meaningful Data)
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center">
                
                {/* Total Records */}
                <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-300">
                    <h3 className="text-xl font-bold text-gray-700 mb-1">
                        {totalRecords}
                    </h3>
                    <p className="text-gray-600 font-semibold">Total Records Analyzed</p>
                </div>
                
                {/* Matches */}
                <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-green-300">
                    <h3 className="text-xl font-bold text-green-700 mb-1">
                        <CheckCircle className="w-5 h-5 mr-1 inline" /> {counts.MATCH}
                    </h3>
                    <p className="text-gray-600 font-semibold">Identical Matches (Green)</p>
                </div>

                {/* Total Unique */}
                <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-red-300">
                    <h3 className="text-xl font-bold text-red-700 mb-1">
                        <Minus className="w-5 h-5 mr-1 inline" /> {totalUnique}
                    </h3>
                    <p className="text-gray-600 font-semibold">Unique Records (Red)</p>
                </div>
            </div>
            
            {/* Detailed Unique Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center pt-2">
                <div className="bg-red-50 p-3 rounded-xl border border-red-300">
                    <p className="font-semibold text-red-700">{counts.UNIQUE_A} Unique Records in File 1 ({file1Name})</p>
                </div>
                <div className="bg-red-50 p-3 rounded-xl border border-red-300">
                    <p className="font-semibold text-red-700">{counts.UNIQUE_B} Unique Records in File 2 ({file2Name})</p>
                </div>
            </div>
        </div>
    );
};


// --- Main Application Component ---

const App = () => {
  const [people1, setPeople1] = useState([]);
  const [people2, setPeople2] = useState([]);
  const [loading1, setLoading1] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [error1, setError1] = useState(null);
  const [error2, setError2] = useState(null);
  const [fileName1, setFileName1] = useState(null);
  const [fileName2, setFileName2] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);
  
  // New state for scroll synchronization
  const [isSyncEnabled, setIsSyncEnabled] = useState(true);

  // Refs for scroll containers
  const scrollRef1 = useRef(null);
  const scrollRef2 = useRef(null);
  
  // State to prevent infinite loop during programmatic scrolling
  const [isScrolling, setIsScrolling] = useState(false);

  const handleFileChange = (event, fileIndex) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ged')) {
      (fileIndex === 1 ? setError1 : setError2)('Please select a valid GEDCOM file (.ged extension).');
      (fileIndex === 1 ? setFileName1 : setFileName2)(null);
      return;
    }

    const setLoading = fileIndex === 1 ? setLoading1 : setLoading2;
    const setError = fileIndex === 1 ? setError1 : setError2;
    const setFileName = fileIndex === 1 ? setFileName1 : setFileName2;
    const setPeople = fileIndex === 1 ? setPeople1 : setPeople2;

    setLoading(true);
    setError(null);
    setFileName(file.name);
    setComparisonResults(null); // Clear comparison when a new file is loaded

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const gedcomText = e.target.result;
        const parsedData = parseGedcom(gedcomText);

        if (parsedData.length === 0) {
            setError("File loaded, but the parser found no individuals. Check file format.");
        }
        setPeople(parsedData);
      } catch (err) {
        console.error(`GEDCOM Parsing Error (File ${fileIndex}):`, err);
        setError("An error occurred during parsing. Check console for details.");
        setPeople([]);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = (e) => {
      console.error(`File Reader Error (File ${fileIndex}):`, e);
      setError("Could not read the file.");
      setPeople([]);
      setLoading(false);
    };
    reader.readAsText(file);
  };
  
  const handleCompare = () => {
    if (people1.length === 0 || people2.length === 0) {
        console.error("Please load both files successfully before comparing.");
        setComparisonResults(null);
        return;
    }
    const results = compareGedcomData(people1, people2);
    setComparisonResults(results);
  };

  // --- Scroll Synchronization Logic ---
  const handleScroll = useCallback((event, currentListIndex) => {
    // Only synchronize if the feature is enabled
    if (!isSyncEnabled || isScrolling) { 
        return;
    }

    const target = event.target;
    // Determine the reference to the *other* scroll container
    const otherRef = currentListIndex === 1 ? scrollRef2 : scrollRef1;
    
    if (otherRef.current) {
        // Mark that a programmatic scroll is about to occur
        setIsScrolling(true);
        
        // Synchronize the other list's scroll position
        otherRef.current.scrollTop = target.scrollTop;

        // Reset the scrolling flag shortly after (debounce)
        // This prevents the programmatic scroll from immediately triggering a reciprocal scroll event.
        setTimeout(() => setIsScrolling(false), 50); 
    }
  }, [isScrolling, isSyncEnabled]); // Include isSyncEnabled in dependencies

  
  const renderFileInput = (index, loading, error, fileName, peopleCount) => (
      <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200">
          <h3 className="text-lg font-bold text-indigo-700 mb-2">File {index}</h3>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            GEDCOM File Upload
          </label>
          <input 
            type="file" 
            accept=".ged" 
            onChange={(e) => handleFileChange(e, index)} 
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
          />
          {loading && <p className="mt-2 text-xs text-indigo-600 flex items-center"><Loader className="w-3 h-3 mr-1 animate-spin" /> Loading...</p>}
          {fileName && (
              <p className="mt-2 text-xs text-gray-500 flex items-center">
                  <FileText className="w-3 h-3 mr-1" />
                  <span className="font-medium text-gray-800 mr-2">Loaded:</span>
                  <span className="font-mono truncate max-w-xs">{fileName}</span>
                  <span className="ml-2 font-semibold text-indigo-600">({peopleCount} records)</span>
              </p>
          )}
          {error && (
              <p className="mt-2 text-xs text-red-600 font-semibold">{error}</p>
          )}
      </div>
  );
  
  const ScrollSyncToggle = () => {
      const toggleSync = () => setIsSyncEnabled(!isSyncEnabled);
      const iconClass = isSyncEnabled ? 'bg-indigo-600' : 'bg-gray-400';
      const labelText = isSyncEnabled ? 'Sync ON' : 'Sync OFF';
      const indicatorClass = isSyncEnabled ? 'bg-indigo-200' : 'bg-gray-200';

      return (
          <div className="hidden lg:flex flex-col items-center justify-center py-4">
              {/* Top Separator */}
              <div className={`h-full w-0.5 ${indicatorClass} rounded-full my-2 transition-colors`}></div>

              {/* Toggle Switch */}
              <div 
                  className={`p-1 ${iconClass} text-white rounded-full shadow-lg cursor-pointer transition-colors hover:shadow-xl`}
                  onClick={toggleSync}
                  title={`Click to turn scroll synchronization ${isSyncEnabled ? 'OFF' : 'ON'}`}
              >
                  <Scroll className="w-5 h-5" />
              </div>

              {/* Toggle Label */}
              <p className={`text-xs font-semibold mt-2 mb-1 ${isSyncEnabled ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {labelText}
              </p>

              {/* Bottom Separator */}
              <div className={`h-full w-0.5 ${indicatorClass} rounded-full my-2 transition-colors`}></div>
          </div>
      );
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-inter">
      {/* Tailwind CSS is loaded here for single-file HTML compilation */}
      <script src="https://cdn.tailwindcss.com"></script>
      <header className="max-w-6xl mx-auto mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
          GEDCOM Tree Comparator
        </h1>
        <p className="text-gray-600">
          Upload two GEDCOM files to view and compare individual records side-by-side using Name, Sex, and Birth details as the primary comparison key.
        </p>
      </header>

      {/* File Input Card Container */}
      <div className="max-w-6xl mx-auto mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderFileInput(1, loading1, error1, fileName1, people1.length)}
        {renderFileInput(2, loading2, error2, fileName2, people2.length)}
      </div>
      
      {/* Compare Button */}
      <div className="max-w-xl mx-auto mb-10 text-center">
          <button
              onClick={handleCompare}
              disabled={people1.length === 0 || people2.length === 0 || loading1 || loading2}
              className={`w-full max-w-sm flex items-center justify-center mx-auto px-6 py-3 text-lg font-bold rounded-full transition duration-200 shadow-xl ${
                  people1.length > 0 && people2.length > 0 && !loading1 && !loading2
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-2xl'
                      : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
          >
              <GitCompare className="w-5 h-5 mr-3" />
              Compare Files
          </button>
      </div>

      {/* Comparison Results Area */}
      <div className="max-w-6xl mx-auto mb-10">
          {comparisonResults && (
             <ComparisonResults 
              comparisonResults={comparisonResults} 
              file1Name={fileName1 || 'File 1'} 
              file2Name={fileName2 || 'File 2'} 
            />
          )}
      </div>

      {/* Side-by-Side Tree Display Area */}
      {(fileName1 || fileName2) && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_50px_1fr] gap-4">
              {/* List 1 */}
              <FileTreeList 
                  people={people1}
                  fileName={fileName1}
                  fileIndex={1}
                  comparisonResults={comparisonResults}
                  comparisonActive={!!comparisonResults}
                  scrollRef={scrollRef1}
                  onScroll={(e) => handleScroll(e, 1)}
              />
              
              {/* Separator / Sync Toggle */}
              <ScrollSyncToggle />

              {/* List 2 */}
              <FileTreeList 
                  people={people2}
                  fileName={fileName2}
                  fileIndex={2}
                  comparisonResults={comparisonResults}
                  comparisonActive={!!comparisonResults}
                  scrollRef={scrollRef2}
                  onScroll={(e) => handleScroll(e, 2)}
              />
              
              {/* Sync hint for mobile/small screens */}
              <div className="lg:hidden col-span-1 text-center text-sm text-gray-500 italic mt-4">
                <Scroll className={`w-4 h-4 mr-1 inline ${isSyncEnabled ? 'text-indigo-500' : 'text-gray-400'}`} /> 
                Scroll synchronization is currently <span className="font-semibold">{isSyncEnabled ? 'ON' : 'OFF'}</span>.
                <button 
                    onClick={() => setIsSyncEnabled(!isSyncEnabled)}
                    className="ml-2 text-indigo-600 font-medium underline"
                >
                    Turn {isSyncEnabled ? 'OFF' : 'ON'}
                </button>
              </div>
          </div>
      )}
      
      {/* Initial Prompt */}
      {!loading1 && !error1 && people1.length === 0 && !fileName1 && (
        <div className="max-w-3xl mx-auto text-center p-12 bg-white rounded-xl shadow-md">
          <GitCompare className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">Load Your GEDCOM Files</h3>
          <p className="mt-2 text-gray-500">
            Upload two `.ged` files to compare the individuals found in each, identifying unique records.
          </p>
        </div>
      )}
    </div>
  );
};

export default App;