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

const IconGear = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      fillRule="evenodd"
      d="M11.983 2.25a1.5 1.5 0 0 1 1.5 1.5v.56c.61.14 1.19.37 1.72.67l.4-.4a1.5 1.5 0 0 1 2.12 0l.985.985a1.5 1.5 0 0 1 0 2.12l-.4.4c.3.53.53 1.11.67 1.72h.56a1.5 1.5 0 0 1 1.5 1.5v1.394a1.5 1.5 0 0 1-1.5 1.5h-.56a7.2 7.2 0 0 1-.67 1.72l.4.4a1.5 1.5 0 0 1 0 2.12l-.985.985a1.5 1.5 0 0 1-2.12 0l-.4-.4a7.2 7.2 0 0 1-1.72.67v.56a1.5 1.5 0 0 1-1.5 1.5h-1.394a1.5 1.5 0 0 1-1.5-1.5v-.56a7.2 7.2 0 0 1-1.72-.67l-.4.4a1.5 1.5 0 0 1-2.12 0l-.985-.985a1.5 1.5 0 0 1 0-2.12l.4-.4a7.2 7.2 0 0 1-.67-1.72h-.56a1.5 1.5 0 0 1-1.5-1.5V12.75a1.5 1.5 0 0 1 1.5-1.5h.56c.14-.61.37-1.19.67-1.72l-.4-.4a1.5 1.5 0 0 1 0-2.12l.985-.985a1.5 1.5 0 0 1 2.12 0l.4.4c.53-.3 1.11-.53 1.72-.67v-.56a1.5 1.5 0 0 1 1.5-1.5h1.394Zm.017 7.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z"
      clipRule="evenodd"
    />
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
  showHint
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
          <IconGear className="profile-settings-svg" />
        </button>
      ) : null}

      {editable ? (
        <div className="profile-top-actions">
          <button
            type="button"
            className="profile-icon-btn"
            onClick={onEdit}
            aria-label="Edit profile"
            title="Edit profile"
            disabled={saving}
          >
            <IconPencil className="profile-icon-svg" />
          </button>
        </div>
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
        </div>

        <div className="profile-name">{displayName || username || '—'}</div>
        {bio ? <div className="profile-bio">{bio}</div> : null}

        {showStats ? (
          <div className="profile-stats">
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
