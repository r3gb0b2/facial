import React, { useState, useEffect } from 'react';
import { UserCircleIcon } from './icons.tsx';

interface UserAvatarProps {
  src?: string;
  alt: string;
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ src, alt, className }) => {
  const [error, setError] = useState(false);

  useEffect(() => {
      setError(false);
  }, [src]);

  if (!src || error || src === 'https://via.placeholder.com/150?text=No+Photo') {
    return (
      <div className={`flex items-center justify-center bg-gray-700 text-gray-500 ${className}`}>
        <UserCircleIcon className="w-full h-full p-2" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
};

export default UserAvatar;