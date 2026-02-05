// Mock types
interface AIKey {
    key: string;
    addedAt: string;
    usageCount: number;
    isExhausted: boolean;
}

interface AIProvider {
    id: string;
    name: string;
    apiKeys: AIKey[];
    isEnabled: boolean;
}

interface SystemSettings {
    appName: string;
    aiProviderConfig?: AIProvider[];
}

// Mock sanitize function from firebase.ts
const sanitizeForFirestore = (obj: any): any => {
  if (obj instanceof Date) {
      return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(v => sanitizeForFirestore(v)).filter(v => v !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const value = sanitizeForFirestore(obj[key]);
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

// Simulation
const mockSettings: SystemSettings = {
    appName: "Test App",
    aiProviderConfig: [
        {
            id: "groq",
            name: "Groq",
            isEnabled: true,
            apiKeys: [
                {
                    key: "gsk_1234567890",
                    addedAt: "2024-01-01T00:00:00.000Z",
                    usageCount: 0,
                    isExhausted: false
                }
            ]
        }
    ]
};

console.log("Original:", JSON.stringify(mockSettings, null, 2));

const sanitized = sanitizeForFirestore(mockSettings);
console.log("Sanitized:", JSON.stringify(sanitized, null, 2));

if (sanitized.aiProviderConfig?.[0]?.apiKeys?.[0]?.key === "gsk_1234567890") {
    console.log("✅ Key preserved!");
} else {
    console.log("❌ Key LOST!");
}
