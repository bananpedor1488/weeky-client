import React from 'react';
import './ProfileCard.css';
import { getUserAvatarSrc } from '../utils/defaultUserAvatar.js';

const IconCamera = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconPencil = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const IconExternal = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3h7v7" />
    <path d="M10 14 21 3" />
    <path d="M21 14v7H3V3h7" />
  </svg>
);

const ProfileCard = ({
  user,
  bannerSrc,
  displayName,
  username,
  bio,
  likesCount,
  playlistsCount,
  followersCount,
  followingCount,
  showStats,
  editable,
  saving,
  error,
  saved,
  onEdit,
  onSettings,
  onOpenProfile,
  onPickBanner,
  onPickAvatar,
  showHint,
  rightAction
}) => {
  const BannerTag = editable ? 'button' : 'div';
  const AvatarTag = editable ? 'button' : 'div';

  return (
    <div className="profile-card">
      <BannerTag
        type={editable ? 'button' : undefined}
        className="profile-banner"
        onClick={editable ? onPickBanner : undefined}
        style={{ backgroundImage: `url(${bannerSrc || ''})` }}
        aria-label={editable ? 'Change banner' : undefined}
      >
        {editable ? (
          <span className="profile-change-icon banner" aria-hidden="true">
            <IconCamera className="profile-change-svg" />
          </span>
        ) : null}
      </BannerTag>

      <AvatarTag
        type={editable ? 'button' : undefined}
        className={editable ? 'profile-avatar-btn' : 'profile-avatar-static'}
        onClick={editable ? onPickAvatar : undefined}
        aria-label={editable ? 'Change avatar' : undefined}
      >
        <img className="profile-avatar" src={getUserAvatarSrc(user)} alt="Avatar" />
        {editable ? (
          <span className="profile-change-icon avatar" aria-hidden="true">
            <IconCamera className="profile-change-svg" />
          </span>
        ) : null}
      </AvatarTag>

      {editable && onSettings ? (
        <button
          type="button"
          className="profile-settings-fab"
          onClick={onSettings}
          aria-label="Settings"
          title="Settings"
          disabled={saving}
        >
          <span className="material-symbols-rounded profile-settings-font" aria-hidden="true">
            settings
          </span>
        </button>
      ) : null}

      {editable && onEdit ? (
        <button
          type="button"
          className="profile-edit-fab"
          onClick={onEdit}
          aria-label="Edit profile"
          title="Edit profile"
          disabled={saving}
        >
          <IconPencil className="profile-icon-svg" />
        </button>
      ) : null}

      <div className="profile-body">
        <div className="profile-body-top">
          <div className="profile-username-row">
            <div className="profile-username">@{username || '—'}</div>
            {onOpenProfile ? (
              <button className="profile-open-btn" type="button" onClick={onOpenProfile} aria-label="Open profile" title="Open profile">
                <IconExternal className="profile-open-svg" />
              </button>
            ) : null}
          </div>

          {rightAction ? <div className="profile-right-action">{rightAction}</div> : null}
        </div>

        <div className="profile-name">{displayName || username || '—'}</div>
        {bio ? <div className="profile-bio">{bio}</div> : null}

        {showStats ? (
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="profile-stat-value">{Number(followersCount || 0)}</div>
              <div className="profile-stat-label">Followers</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{Number(followingCount || 0)}</div>
              <div className="profile-stat-label">Following</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{Number(likesCount || 0)}</div>
              <div className="profile-stat-label">Likes</div>
            </div>
            <div className="profile-stat">
              <div className="profile-stat-value">{Number(playlistsCount || 0)}</div>
              <div className="profile-stat-label">Playlists</div>
            </div>
          </div>
        ) : null}

        {error ? <div className="account-error">{error}</div> : null}
        {saved ? <div className="account-saved">Saved</div> : null}

        {showHint ? <div className="profile-hint">Tap banner/avatar to change</div> : null}
      </div>
    </div>
  );
};

export default ProfileCard;
