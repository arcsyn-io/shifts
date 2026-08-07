import logoSource from '@arcsyn-io/presentations/logo.png';

export function ArcSynLogo() {
  return (
    <span className="arcsyn-logo">
      <img className="arcsyn-logo__image" src={logoSource} alt="ArcSyn" />
    </span>
  );
}
