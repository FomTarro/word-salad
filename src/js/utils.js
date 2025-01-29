/**
 * Checks to see if Version A is older than Version B. 
 * @param {string} versionA formatted as x.x.x
 * @param {string} versionB formatted as x.x.x
 * @returns True if Version A is older than Version B. False otherwise.
 */
function isOlderThan(versionA, versionB) {
    return versionA == undefined 
    || versionA.length <= 0 
    || (versionB != undefined && versionA.localeCompare(versionB) < 0);
}

/** For each property of object A, if object B has a value for that property, apply it to Object A.
 * Returns a new instance/clone of A with the new values.
 * @param {object} a 
 * @param {object} b 
 * @returns {object} - A new instance of A with all properties merged in.
 */
function merge(a, b){
    var c = {}
    for(var prop in a){
        if(b && b[prop]){
            c[prop] = b[prop]
        }else{
            c[prop] = a[prop]
        }
    }
    return c;
}

module.exports.isOlderThan = isOlderThan;
module.exports.merge = merge;