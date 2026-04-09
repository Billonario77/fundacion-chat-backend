"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/registro', authController_1.validateRegistro, authController_1.registro);
router.post('/login', authController_1.validateLogin, authController_1.login);
router.get('/perfil', auth_1.authenticateToken, authController_1.perfil);
exports.default = router;
//# sourceMappingURL=authRoutes.js.map