'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface ProfileImageSelectorProps {
  userId: string;
  currentImage?: string;
  onImageSelected?: (imagePath: string) => void;
}

const ProfileImageSelector: React.FC<ProfileImageSelectorProps> = ({ 
  userId, 
  currentImage = 'player-icon-1.png',
  onImageSelected
}) => {
  const [selectedImage, setSelectedImage] = useState(currentImage);
  const [saving, setSaving] = useState(false);

  const profileImages = [
    'player-icon-1.png',
    'player-icon-2.png',
    'player-icon-3.png',
    'player-icon-4.png',
    'player-icon-5.png',
    'player-icon-6.png',
    'player-icon-7.png',
    'player-icon-8.png',
    'player-icon-9.png',
    'player-icon-10.png',
  ];

  const handleImageSelect = async (image: string) => {
    setSelectedImage(image);
    
    if (onImageSelected) {
      onImageSelected(image);
    }
    
    if (userId) {
      setSaving(true);
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          profileImage: image
        });
      } catch (error) {
        console.error('Error updating profile image:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="profile-image-selector">
      <div className="grid grid-cols-5 gap-3">
        {profileImages.map((image) => (
          <div 
            key={image}
            className={`relative cursor-pointer rounded-lg overflow-hidden border-4 transition-all ${
              selectedImage === image ? 'border-[#8bb8a8] scale-105' : 'border-transparent hover:border-gray-300'
            }`}
            onClick={() => handleImageSelect(image)}
          >
            <img 
              src={`/images/${image}`}
              alt="Profile icon"
              className="w-full h-full object-cover"
            />
            {saving && selectedImage === image && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileImageSelector; 