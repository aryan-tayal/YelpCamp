const { campgroundSchema, reviewSchema } = require('./schema');
const ExpressError = require('./utils/ExpressError');
const Campground = require('./models/campground')
const Review = require('./models/reviews');
const User = require('./models/user');

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'You must be signed in first');
        return res.redirect('/login');
    }
    if (req.xhr) {
        return res.send({ error: 'Login required' })
    }
    next();
}

module.exports.validateCampground = (req, res, next) => {
    const { error } = campgroundSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(',')
        throw new ExpressError(msg, 400)
    } else {
        next();
    }
}

module.exports.isAuthor = async (req, res, next) => {
    const { id } = req.params;
    const campground = await Campground.findById(id);
    if (!campground.author.equals(req.user._id)) {
        req.flash('error', 'You do not have permission to edit this campground!')
        return res.redirect(`/campgrounds/${id}`)
    }
    next();
}


module.exports.isReviewAuthor = async (req, res, next) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review.author.equals(req.user._id)) {
        req.flash('error', 'You do not have permission to delete this review!')
        return res.redirect(`/campgrounds/${id}`)
    }
    next();
}

module.exports.validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => { el.message }).join(',')
        throw new ExpressError(error.details[0].message, 400);
    }
    else {
        next();
    }
}

module.exports.isProfileAuthor = async (req, res, next) => {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user._id.equals(req.user._id)) {
        req.flash('error', 'You do not have permission to delete this profile!')
        return res.redirect(`/users`)
    }
    next();
}

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports.paginateResults = model => {
    return async (req, res, next) => {
        let allCampgrounds = [];
        // console.log(req.query.search);
        if (req.query.search) {
            const regex = new RegExp(escapeRegex(req.query.search), 'gi');
            allCampgrounds = await Campground.find({ title: regex });
            
        } else {
            allCampgrounds = await Campground.find({});
        }
        // const allCampgrounds = await Campground.find({});

        const page = parseInt(req.query.page) || 1;
        const limit = 20;

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const campgrounds = {};

        campgrounds.campgrounds = allCampgrounds.slice(startIndex, endIndex);
        if (endIndex < allCampgrounds.length) {
            campgrounds.next = {
                page: page + 1,
                limit: limit
            }
        } else {
            campgrounds.next = {
                page: null,
                limit: limit
            }
        }
        if (startIndex > 1) {
            campgrounds.previous = {
                page: page - 1,
                limit: limit
            }
        } else {
            campgrounds.previous = {
                page: null,
                limit: limit
            }
        }
        campgrounds.pages = ~~(allCampgrounds.length / limit);

        res.paginatedResults = campgrounds;
        next();
    }
}

module.exports.isPaid = (req, res, next) => {
    if (req.user.isPaid) return next();
    req.flash('error', 'Please complete registration first');
    res.redirect('/checkout')
}