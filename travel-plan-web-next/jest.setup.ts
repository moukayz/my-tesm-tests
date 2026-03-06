import '@testing-library/jest-dom'

// Required for React 19 concurrent rendering in Jest
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
