import { BUILD_VERSION } from '../config/buildVersion';

export default function BuildVersion() {
  return (
    <footer className="build-version" aria-label={`Build ${BUILD_VERSION}`}>
      Build: {BUILD_VERSION}
    </footer>
  );
}
