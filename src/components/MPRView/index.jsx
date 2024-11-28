// src/components/MPRView/index.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDicom } from '../../context/DicomContext';
import WebGLViewer, { ViewTypes } from '../DicomViewer/WebGLViewer';

function MPRView() {
    const navigate = useNavigate();
    const { volumeData } = useDicom();
    const [axialOffset, setAxialOffset] = useState(0.5);
    const [sagittalOffset, setSagittalOffset] = useState(0.5);
    const [coronalOffset, setCoronalOffset] = useState(0.5);

    if (!volumeData) {
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100vh' 
            }}>
                <button 
                    onClick={() => navigate('/')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#4A90E2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    DICOM 파일을 먼저 업로드해주세요
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px' }}>
            <button 
                onClick={() => navigate('/')}
                style={{ 
                    marginBottom: '20px',
                    padding: '8px 16px',
                    backgroundColor: '#4A90E2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                뒤로 가기
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div>
                        <h3 style={{ marginBottom: '10px' }}>Axial View</h3>
                        <WebGLViewer 
                            volumeData={volumeData} 
                            sliceOffset={axialOffset} 
                            viewType={ViewTypes.AXIAL}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={axialOffset}
                            onChange={(e) => setAxialOffset(parseFloat(e.target.value))}
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '10px' }}>Sagittal View</h3>
                        <WebGLViewer 
                            volumeData={volumeData} 
                            sliceOffset={sagittalOffset} 
                            viewType={ViewTypes.SAGITTAL}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={sagittalOffset}
                            onChange={(e) => setSagittalOffset(parseFloat(e.target.value))}
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div>
                        <h3 style={{ marginBottom: '10px' }}>Coronal View</h3>
                        <WebGLViewer 
                            volumeData={volumeData} 
                            sliceOffset={coronalOffset} 
                            viewType={ViewTypes.CORONAL}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={coronalOffset}
                            onChange={(e) => setCoronalOffset(parseFloat(e.target.value))}
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MPRView;
