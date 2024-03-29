const Campground = require("../models/campground");
const User = require("../models/user");
const Notification = require("../models/notifications");
const { cloudinary } = require("../cloudinary");
const mapBoxToken = process.env.MAPBOX_TOKEN;
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const geocoder = mbxGeocoding({ accessToken: mapBoxToken });

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports.index = async (req, res) => {
  if (req.query.paid)
    res.locals.success = "Payment succeeded, welocme to YelpCamp";
  const campgrounds = res.paginatedResults;
  const allCampgrounds = await Campground.find({});
  if (campgrounds.campgrounds.length === 0) {
    req.flash("error", "No more campgrounds to view");
    res.redirect("/campgrounds");
  }
  res.render("campgrounds/index", { ...campgrounds, allCampgrounds });
};

module.exports.newForm = (req, res) => {
  res.render("campgrounds/new");
};

module.exports.createCampground = async (req, res, next) => {
  const geoData = await geocoder
    .forwardGeocode({
      query: req.body.campground.location,
      limit: 1,
    })
    .send();
  const campground = new Campground(req.body.campground);
  if (!geoData) {
    req.flash(
      "error",
      "Location not found! Setting default location New York!!"
    );
    campground.geometry = {
      type: "Point",
      coordinates: [-73.9826608125, 40.76872225],
    };
  }
  campground.geometry = geoData.body.features[0].geometry;
  campground.images = req.files.map((f) => ({
    url: f.path,
    filename: f.filename,
  }));
  campground.author = req.user._id;

  const user = await User.findById(req.user._id).populate("followers").exec();
  let newNotification = {
    username: req.user.username,
    campgroundId: campground.id,
  };
  for (const follower of user.followers) {
    let notification = await Notification.create(newNotification);
    follower.notifications.push(notification);
    follower.save();
  }

  await campground.save();
  req.flash("success", "Successfully made a new campground!");
  res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.showCampground = async (req, res) => {
  const campground = await Campground.findById(req.params.id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("author");
  if (!campground) {
    req.flash("error", "Sorry! Cannot find that campground!");
    res.redirect("/campgrounds");
  }
  res.render("campgrounds/show", { campground });
};

module.exports.editForm = async (req, res) => {
  const { id } = req.params;
  const campground = await Campground.findById(id);
  if (!campground) {
    req.flash("error", "Sorry! Cannot find that campground!");
    res.redirect("/campgrounds");
  }
  res.render("campgrounds/edit", { campground });
};

module.exports.updateCampground = async (req, res) => {
  const { id } = req.params;
  console.log(req.body);
  const campground = await Campground.findByIdAndUpdate(id, {
    ...req.body.campground,
  });
  const imgs = req.files.map((f) => ({ url: f.path, filename: f.filename }));
  campground.images.push(...imgs);
  await campground.save();
  if (req.body.deleteImages) {
    for (let filename of req.body.deleteImages) {
      await cloudinary.uploader.destroy(filename);
    }
    await campground.updateOne({
      $pull: { images: { filename: { $in: req.body.deleteImages } } },
    });
  }
  req.flash("success", "Successfully updated campground!");
  res.redirect(`/campgrounds/${campground._id}`);
};

module.exports.deleteCampground = async (req, res) => {
  const { id } = req.params;
  await Campground.findByIdAndDelete(id);
  req.flash("success", "Successfully deleted campground!");
  res.redirect("/campgrounds");
};
