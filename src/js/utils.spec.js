const { isOlderThan, merge } = require("./utils");

describe("Verison Comparison Tests", () => {
    test("Version Comparison 1", async() => {
        expect(isOlderThan(`0.1.0`, `1.0.0`)).toBe(true);
    })
    test("Version Comparison 2", async() => {
        expect(isOlderThan(`1.0.0`, `1.0.1`)).toBe(true);
    })
    test("Version Comparison 3", async() => {
        expect(isOlderThan(`1.0.1`, `1.0.1`)).toBe(false);
    })
    test("Version Comparison 4", async() => {
        expect(isOlderThan(`2.0.1`, `1.0.1`)).toBe(false);
    })
    test("Version Comparison 5", async() => {
        expect(isOlderThan(`1.0.1`, `1.1.0`)).toBe(true);
    })
    test("Version Comparison 6", async() => {
        expect(isOlderThan(`1.0.1`, undefined)).toBe(false);
    })
    test("Version Comparison 7", async() => {
        expect(isOlderThan(undefined, `1.0.0`)).toBe(true);
    })
    test("Version Comparison 8", async() => {
        expect(isOlderThan(`1.0.0`, `nonsense`)).toBe(true);
    })
});

describe("Merge Tests", () => {
    test("Merge 1", async() => {
        const source = {
            a: 1,
            b: 2,
            c: 3
        }
        const load = {
            a: 5
        }
        expect(merge(source, load)).toEqual({
            a: 5,
            b: 2,
            c: 3
        });
    })
    test("Merge 2", async() => {
        const source = {
            a: 1,
            b: 2,
            c: 3
        }
        const load = {
            d: 4
        }
        expect(merge(source, load)).toEqual({
            a: 1,
            b: 2,
            c: 3
        });
    })
    test("Merge 3", async() => {
        const source = {
            a: 1,
            b: 2,
            c: 3
        }
        const load = {
            a: 5,
            d: 4
        }
        expect(merge(source, load)).toEqual({
            a: 5,
            b: 2,
            c: 3
        });
    })

});