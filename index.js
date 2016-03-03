'use strict';

const async = require('async');
const EventEmitter = require('events');
const Magister = require('magister.js');

const primaryClasses = ['ne', 'fa', 'en', 'wi', 'gs', 'lv', 'ak', 'bi', 'mu', 'te'];

module.exports = function(credentials, options) {
	options = options || {};
	options.interval = options.interval || 10 * 60 * 1000;
	options.startDate = options.startDate || new Date();

	const emitter = new EventEmitter();
	let latestGradeTime = options.startDate;

	let checkGrades = function() {
		new Magister.Magister(credentials).ready(function(error) {
			if (error) return emitter.emit('error', normalizeError(error));
			this.currentCourse(function(error, course) {
        if (error) return emitter.emit('error', normalizeError(error));
				async.parallel([
					fetchClasses.bind(null, course),
					fetchNewGrades.bind(null, course, latestGradeTime),
				], function(error, results) {
          if (error) return emitter.emit('error', normalizeError(error));
					const classesById = results[0];
					const gradesResult = results[1];
					latestGradeTime = gradesResult.latestGradeTime;
					for (let grade of gradesResult.grades) {
						const gradeClass = grade.class();
						emitter.emit('grade', {
              grade: +(grade.grade().replace(',', '.')),
							isPass: grade.passed(),
							description: grade.description(),
							weight: grade.weight(),
							className: getFullClassName(gradeClass, classesById),
							classAverage: gradesResult.averages[gradeClass.id],
							overallAverage: gradesResult.overallGrade,
							overallPoints: gradesResult.overallPoints,
						});
					}
				});
			});
		});
	};

	setTimeout(checkGrades, 0);

	// Only run this periodically if a positive interval is given (run once otherwise)
	if (options.interval > 0) {
		setInterval(checkGrades, options.interval);
	}

	return emitter;
}

function fetchClasses(course, callback) {
	let callbackCalled = false;
	course.classes(function(error, courseClasses) {
		if (callbackCalled) return;
		callbackCalled = true;

		if (error) return callback(error);

		let classesById = {};
		for (let courseClass of courseClasses) {
			classesById[courseClass.id()] = courseClass;
		}

		callback(null, classesById);
	});
}

function fetchNewGrades(course, latestGradeTime, callback) {
	let callbackCalled = false;
	course.grades(false, true, function(error, grades) {
		if (callbackCalled) return;
		callbackCalled = true;

		if (error) return callback(error);

		let gradesToNotify = [];
		let classAverages = {};
		let overallAverage = null;
		let newLatestGradeTime = latestGradeTime;

		let primaryClassesTotal = 0;
		let primaryClassesCount = 0;

		for (let grade of grades) {
			const gradeType = grade.type();
			const gradePeriod = grade.gradePeriod();
			const gradeClass = grade.class();

			if (gradePeriod.name == 'EIND') {
				if (gradeClass.abbreviation == 'gem') {
					overallAverage = +(grade.grade().replace(',', '.'));
				} else {
					classAverages[gradeClass.id] = +(grade.grade().replace(',', '.'));
					if (primaryClasses.indexOf(gradeClass.abbreviation) >= 0) {
						primaryClassesTotal += +(grade.grade().replace(',', '.'));
						primaryClassesCount++;
					}
				}
			} else if (gradeType.typeString() == 'grade') {
				if (grade.dateFilledIn() <= latestGradeTime) continue;
				gradesToNotify.push(grade);
				if (grade.dateFilledIn() > newLatestGradeTime) newLatestGradeTime = grade.dateFilledIn();
			}
		}

		if (!overallAverage) {
			// No more overall grade in overview, let's calculate it ourselves
			overallAverage = Math.floor(10 * primaryClassesTotal / primaryClassesCount) / 10;
		}

		callback(null, {
			grades: gradesToNotify,
			averages: classAverages,
			overallGrade: overallAverage,
			overallPoints: primaryClassesTotal,
			latestGradeTime: newLatestGradeTime,
		});
	});
}

function getFullClassName(gradeClass, classesById) {
	let className = gradeClass.abbreviation;
	if (gradeClass.id in classesById) {
		className = classesById[gradeClass.id].description();
		className = className.replace(/e taal$/i, '');
		className = className.replace(/^levensbesch.*$/i, 'levensbeschouwing');
		className = className.replace(/^lichamelijke opv.*$/i, 'gym');
		className = className.replace(/^informatiekund.*$/i, 'informatiekunde');
		className = className.charAt(0).toUpperCase() + className.slice(1);
	}
	return className;
}

function normalizeError(error) {
	if (typeof error == 'string') {
	  if (error.charAt(0) == '{') {
	    error = JSON.parse(error);
	  } else {
	    return new Error(error);
	  }
	}

	if (typeof error == 'object' && error.constructor.name != 'Error') {
	  if (error.message) return new Error(error.message);
	  if (error.Message) return new Error(error.Message);
	  return new Error(error.toString());
	}

  return error;
}
