// src/components/MPRView/index.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDicom } from '../../context/DicomContext';
import SliceEngine, { ViewTypes } from '../Engine/SliceEngine';
import VolumeEngine from '../Engine/VolumeEngine';

function MPRView() {
    const navigate = useNavigate();
    const { volumeData } = useDicom();
    const [axialOffset, setAxialOffset] = useState(0.5);
    const [sagittalOffset, setSagittalOffset] = useState(0.5);
    const [coronalOffset, setCoronalOffset] = useState(0.5);
    
    const stepSize = volumeData ? 1 / (volumeData.depth - 1) : 0.01;
    const getCurrentSliceNumber = (offset, totalSlices) => {
        return Math.round(offset * (totalSlices - 1)) + 1;
    };

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
                        <SliceEngine 
                            volumeData={volumeData} 
                            sliceOffset={axialOffset} 
                            viewType={ViewTypes.AXIAL}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step={stepSize}
                            value={axialOffset}
                            onChange={(e) => setAxialOffset(parseFloat(e.target.value))}
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                        <div style={{ textAlign: 'center' }}>
                            Slice: {getCurrentSliceNumber(axialOffset, volumeData.depth)} / {volumeData.depth}
                        </div>
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '10px' }}>Sagittal View</h3>
                        <SliceEngine 
                            volumeData={volumeData} 
                            sliceOffset={sagittalOffset} 
                            viewType={ViewTypes.SAGITTAL}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step={stepSize}
                            value={sagittalOffset}
                            onChange={(e) => setSagittalOffset(parseFloat(e.target.value))}
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                        <div style={{ textAlign: 'center' }}>
                            Slice: {getCurrentSliceNumber(sagittalOffset, volumeData.depth)} / {volumeData.depth}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div>
                        <h3 style={{ marginBottom: '10px' }}>Coronal View</h3>
                        <SliceEngine 
                            volumeData={volumeData} 
                            sliceOffset={coronalOffset} 
                            viewType={ViewTypes.CORONAL}
                        />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step={stepSize}
                            value={coronalOffset}
                            onChange={(e) => setCoronalOffset(parseFloat(e.target.value))}
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                        <div style={{ textAlign: 'center' }}>
                            Slice: {getCurrentSliceNumber(coronalOffset, volumeData.depth)} / {volumeData.depth}
                        </div>
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '10px' }}>3D Volume View</h3>
                        <VolumeEngine 
                            volumeData={volumeData} 
                            rotationX={0} 
                            rotationY={0}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MPRView;
