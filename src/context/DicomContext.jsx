// src/context/DicomContext.jsx
import { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types'; // 이 줄 추가

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

// PropTypes 정의 추가
DicomProvider.propTypes = {
    children: PropTypes.node.isRequired
};

export function useDicom() {
    return useContext(DicomContext);
}
