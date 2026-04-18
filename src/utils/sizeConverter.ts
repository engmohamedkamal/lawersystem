
export const parseStorageSize = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;

    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|K|M|G|T)?$/i);
    if (!match) {
        const num = Number(value);
        return isNaN(num) ? 0 : num;
    }

    const num = parseFloat(match[1] || "0");
    const unit = (match[2] || "").toUpperCase();

    const units: Record<string, number> = {
        'B': 1,
        'KB': 1024,
        'K': 1024,
        'MB': 1024 * 1024,
        'M': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'G': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024,
        'T': 1024 * 1024 * 1024 * 1024,
    };

    return Math.floor(num * (units[unit] || 1));
};

export const formatStorageBytes = (bytes: any): string => {
    if (typeof bytes !== 'number' || isNaN(bytes)) return bytes;
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
