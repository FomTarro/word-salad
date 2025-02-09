const { menuTemplate } = require("../src/js/menu");

describe("Menu Load Tests", () => {
    test("Menu Synthesis Test", async() => {
        const menu = menuTemplate({}, () => { });
        expect(menu.length).toBe(3);
        expect(menu[0].label).toBe("File");
        expect(menu[1].label).toBe("View");
        expect(menu[2].label).toBe("Help");
    });

    test("Menu Click Test", async() => {
        let counter = 0;
        const menu = menuTemplate({
            openExternal: (path) => {
                counter++;
            }
        }, () => { return 1111; });
        await menu[2].submenu[0].click();
        await menu[2].submenu[1].click();
        await menu[2].submenu[2].click();
        expect(counter).toBe(3);
    })

    test("Menu Port Set Test", async() => {
        let p = "";
        const menu = menuTemplate({
            openExternal: (path) => {
                p = path;
            }
        }, () => { return 1111; });
        await menu[2].submenu[0].click();
        expect(p).toBe('http://localhost:1111/readme');
    })
});