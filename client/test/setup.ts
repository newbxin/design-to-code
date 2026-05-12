import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
});

Object.defineProperty(window, "getComputedStyle", {
  value: (element: Element) => ({
    getPropertyValue: (property: string) => {
      const htmlElement = element as HTMLElement;
      return htmlElement.style.getPropertyValue(property);
    }
  })
});
