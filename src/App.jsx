// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DicomView from './components/DicomView';
import MPRView from './components/MPRView';
import { DicomProvider } from './context/DicomContext';

function App() {
    return (
        <DicomProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<DicomView />} />
                    <Route path="/mpr" element={<MPRView />} />
                </Routes>
            </BrowserRouter>
        </DicomProvider>
    );
}

export default App;
