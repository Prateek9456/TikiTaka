export async function detectUserLocation(): Promise<string> {
  const fromBrowser = await detectFromBrowserGeolocation();
  if (fromBrowser) {
    return fromBrowser;
  }
  return detectFromIp();
}

async function detectFromBrowserGeolocation(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      });
    });

    const { latitude, longitude } = position.coords;
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };

    return formatLocation(
      data.city || data.locality,
      data.principalSubdivision,
      data.countryName,
    );
  } catch {
    return null;
  }
}

async function detectFromIp(): Promise<string> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      return '';
    }
    const data = (await response.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      error?: boolean;
    };
    if (data.error) {
      return '';
    }
    return formatLocation(data.city, data.region, data.country_name) ?? '';
  } catch {
    return '';
  }
}

function formatLocation(
  city?: string | null,
  region?: string | null,
  country?: string | null,
): string | null {
  const parts = [city, region, country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      unique.push(part);
    }
  }
  return unique.length > 0 ? unique.join(', ') : null;
}
