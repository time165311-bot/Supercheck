import React from 'react';
import { ProfileModal } from './ProfileModal';
import { User } from '../types';

export interface UserProfileModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onUpdateAvatar?: (newAvatar: string) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onUpdateSignature?: (newSignature: string) => void;
  onUpdatePosition?: (newPosition: string) => void;
  onOpenPasswordModal?: () => void;
  onLogout?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = (props) => {
  return <ProfileModal {...props} />;
};

export default UserProfileModal;
