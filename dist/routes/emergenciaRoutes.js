"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emergenciaController_1 = require("../controllers/emergenciaController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/activar', emergenciaController_1.activarEmergencia);
exports.default = router;
//# sourceMappingURL=emergenciaRoutes.js.map