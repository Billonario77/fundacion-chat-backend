"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminUsuariosController_1 = require("../controllers/adminUsuariosController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.use(auth_1.requireAdmin);
router.get('/usuarios', adminUsuariosController_1.getUsuarios);
router.get('/guias', adminUsuariosController_1.getGuias);
router.patch('/usuarios/:usuarioId/toggle', adminUsuariosController_1.toggleUsuarioEstado);
router.patch('/guias/:guiaId/toggle', adminUsuariosController_1.toggleGuiaDisponibilidad);
router.patch('/usuarios/:usuarioId/rol', adminUsuariosController_1.actualizarRol);
exports.default = router;
//# sourceMappingURL=adminUsuariosRoutes.js.map