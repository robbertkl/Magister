'use strict';

const async = require('async');
const EventEmitter = require('events');
const Magister = require('magister.js');

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
              grade: parseFloat(grade.grade().replace(',', '.')),
							isPass: grade.passed(),
							description: grade.description(),
							weight: grade.weight(),
							className: getFullClassName(gradeClass, classesById),
							classAverage: gradesResult.averages[gradeClass.id],
							overallAverage: gradesResult.overallGrade,
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

		for (let grade of grades) {
			const gradeType = grade.type();
			const gradePeriod = grade.period();
			const gradeClass = grade.class();
			const gradeGrade = parseFloat(grade.grade().replace(',', '.'));

			if (gradePeriod.name() == 'EIND') {
				if (gradeClass.abbreviation == 'gem') {
					overallAverage = gradeGrade;
				} else {
					classAverages[gradeClass.id] = gradeGrade;
				}
			} else if (gradeType.typeString() == 'grade') {
				if (grade.dateFilledIn() <= latestGradeTime) continue;
				gradesToNotify.push(grade);
				if (grade.dateFilledIn() > newLatestGradeTime) newLatestGradeTime = grade.dateFilledIn();
			}
		}

		callback(null, {
			grades: gradesToNotify,
			averages: classAverages,
			overallGrade: overallAverage,
			latestGradeTime: newLatestGradeTime,
		});
	});
}

function getFullClassName(gradeClass, classesById) {
	let className = gradeClass.abbreviation;
	if (gradeClass.id in classesById) {
		className = classesById[gradeClass.id].description();
		className = className.replace(/e taal$/i, '');
		className = className.replace(/^cambridge.*$/i, 'engels');
		className = className.replace(/^latijn.*$/i, 'latijn');
		className = className.replace(/^grieks.*$/i, 'grieks');
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
