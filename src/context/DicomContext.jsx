// src/context/DicomContext.jsx
import { createContext, useContext, useState } from 'react';

const DicomContext = createContext();

export function DicomProvider({ children }) {
    const [volumeData, setVolumeData] = useState(null);
    const [loadedImages, setLoadedImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    return (
        <DicomContext.Provider value={{
            volumeData,
            setVolumeData,
            loadedImages,
            setLoadedImages,
            currentImageIndex,
            setCurrentImageIndex
        }}>
            {children}
        </DicomContext.Provider>
    );
}

export function useDicom() {
    return useContext(DicomContext);
}
