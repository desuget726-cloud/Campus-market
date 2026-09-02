export const safeObject = (data = {}) => {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data;
    }

    return {};
};

export const getObjectKeysSafely = (data) => Object.keys(safeObject(data));
