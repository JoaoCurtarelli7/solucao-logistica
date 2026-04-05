"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = void 0;
function requirePermission(permissionKey) {
    return async (req, rep) => {
        const permissions = req.user?.permissions ?? [];
        if (!permissions.includes(permissionKey)) {
            return rep.code(403).send({ message: "Sem permissão para esta ação" });
        }
    };
}
exports.requirePermission = requirePermission;
