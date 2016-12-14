LocalStorage = {
    set: function(key, data) {
        if (!window.localStorage)
            return console.error("No localstorage");
        localStorage.setItem(key, JSON.stringify(data));
    },
    get: function(key) {
        var data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
}