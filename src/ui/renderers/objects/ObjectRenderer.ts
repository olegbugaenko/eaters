export abstract class ObjectRenderer {

    register() {
        // This method is supposed to be called when object is first time
        // added to scene. This registers separately static primitives and dynamic primitives
    }

    update() {
        // This method is supposed to update only dynamic primitives
    }

}