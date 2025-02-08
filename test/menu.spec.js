const { MenuTemplate } = require("../src/js/menu");

describe("Menu Load Tests", () => {
    test("Menu Synthesis Test", async() => {
        const menu = MenuTemplate(() => { });
        expect(menu.length).toBe(3);
        expect(menu[0].label).toBe("File");
        expect(menu[1].label).toBe("View");
        expect(menu[2].label).toBe("Help");
    })
});