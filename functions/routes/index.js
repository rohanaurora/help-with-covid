const express = require("express");

const neighborhoodService = require("../services/neighborhood");
const onFleetService = require("../services/onfleet");
const firebaseService = require("../services/firebase");
const sendgridService = require("../services/sendgrid");

const router = express.Router({ mergeParams: true });

router.get("/task/:id", async function(req, res) {
    const result = await onFleetService.getTask(req.params.id);
    res.json(result);
});

router.post("/task", async function(req, res, next) {
    const address = req.body.address;
    try {
        const neighborhoodName = await neighborhoodService.getNeighborhood({
            streetAddress: address.number + " " + address.street,
            unit: address.apartment,
            city: address.city,
            state: address.state,
            zipcode: address.postalCode
        });
        console.log(neighborhoodName);
        const results = await onFleetService.createTask(
            req.body.address,
            req.body.person,
            req.body.notes
        );
        res.json(results);
    } catch (error) {
        next(error);
    }
});

router.patch("/task/:id", async function(req, res) {
    const results = await onFleetService.updateTask(req.params.id, req.body);
    res.json(results);
});

router.delete("/task/:id", async function(req, res) {
    const results = await onFleetService.deleteTask(req.params.id);
    res.json(results);
});

router.post("/neighborhood", async function(req, res) {
    const address = req.body.address;
    const neighborhoodData = await neighborhoodService.getNeighborhood({
        streetAddress: address.number + " " + address.street,
        unit: address.apartment,
        city: address.city,
        state: address.state,
        zipcode: address.postalCode
    });
    //also create the neighborhood while we are at it if it doesn't exist
    const doesExist = firebaseService.getTeam(neighborhoodData.id.toString());
    if (!doesExist.data) {
        try {
            const results = await onFleetService.createTeam(neighborhoodData);

            await firebaseService.writeNewTeam(
                results.name,
                results.onFleetID,
                results.neighborhoodID
            );
        } catch (error) {
            next(error);
        }
    }
    return res.json(neighborhoodData);
});

router.post("/team", async function(req, res, next) {
    const address = req.body.address;
    const neighborhoodData = await neighborhoodService.getNeighborhood({
        streetAddress: address.number + " " + address.street,
        unit: address.apartment,
        city: address.city,
        state: address.state,
        zipcode: address.postalCode
    });
    try {
        const results = await onFleetService.createTeam(neighborhoodData);

        await firebaseService.writeNewTeam(
            results.name,
            results.onFleetID,
            results.neighborhoodID
        );
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
});

router.get("/team/:id", async function (req, res, next) {
    const team = await firebaseService.getTeam(req.params.id);

    if (!team) {
        return next(new Error("Team doesn't exist!"));
    }

    return res.json(team);
});
router.post("/worker", async function (req, res, next) {
    const phone = req.body.phone;
    const name = req.body.name;
    const neighborhoodId = req.body.neighborhoodID;
    try {
        const neighborhoodData = await firebaseService.getTeam(neighborhoodId);
        const onfleetTeamId = neighborhoodData.OnFleetID;
        const results = await onFleetService.createWorker(
            onfleetTeamId,
            name,
            phone
        );

        await sendgridService.addEmailToList(
            req.body.email,
            process.env.SENDGRID_VOLUNTEERS_LIST_ID
        );
        res.status(200).json(results);
    } catch (error) {
        next(error);
    }
});

router.post("/email", async function (req, res, next) {
    console.log(req.body.email);
    try {
        const result = await sendgridService.addEmailToList(
            req.body.email,
            process.env.SENDGRID_MARKETING_LIST_ID
        );
        res.status(result.statusCode).send();
    } catch (error) {
        next(error);
    }
});
module.exports = router;
