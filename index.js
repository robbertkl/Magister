'use strict';

const async = require('async');
const EventEmitter = require('events');
const Magister = require('magister.js');
const getAuthCode = require('magister-authcode');

module.exports = function(credentials, options) {
	options = options || {};
	options.interval = options.interval || 10 * 60 * 1000;
	options.startDate = options.startDate || new Date();

	const emitter = new EventEmitter();
	let latestGradeTime = options.startDate;

	let checkGrades = async function() {
		try {
			if (typeof credentials.school == 'string') {
				const schools = await Magister.getSchools(credentials.school);
				credentials.school = schools.find(school => school.name == credentials.school);				
			}

			if (!('authCode' in credentials)) {
				credentials.authCode = await getAuthCode();
			}

			const magister = await Magister.default(credentials);
			const course = (await magister.courses()).pop();
			
			const classesById = await fetchClasses(course);
			const gradesResult = await fetchNewGrades(course, latestGradeTime);
			
			latestGradeTime = gradesResult.latestGradeTime;
			for (let grade of gradesResult.grades) {
				const gradeClass = grade.class;
				emitter.emit('grade', {
				  grade: parseFloat(grade.grade.replace(',', '.')),
					isPass: grade.passed,
					description: grade.description,
					weight: grade.weight,
					className: getFullClassName(gradeClass, classesById),
					classAverage: gradesResult.averages[gradeClass.id],
					firstName: magister.profileInfo.firstName,
				});
			}
		} catch (error) {
			const normalizedError = normalizeError(error);
			if (normalizedError.message == 'Invalid username') {
				try {
					const newAuthCode = await getAuthCode();
					if (newAuthCode != credentials.authCode) {
						// Ignore the error and try again next time
						credentials.authCode = newAuthCode;
						return;
					}
				} catch (error) {}
			}
			emitter.emit('error', normalizedError);
		}
	};

	setTimeout(checkGrades, 0);

	// Only run this periodically if a positive interval is given (run once otherwise)
	if (options.interval > 0) {
		setInterval(checkGrades, options.interval);
	}

	return emitter;
}

async function fetchClasses(course) {
	return (await course.classes()).reduce((classesById, courseClass) => {
		classesById[courseClass.id] = courseClass;
		return classesById;
	}, {});
}

async function fetchNewGrades(course, latestGradeTime, callback) {
	let gradesToNotify = [];
	let classAverages = {};
	let overallAverage = null;
	let newLatestGradeTime = latestGradeTime;

	for (const grade of await course.grades()) {
		const gradeType = grade.type;
		const gradeClass = grade.class;
		const gradeGrade = parseFloat(grade.grade.replace(',', '.'));
		
		if (gradeType.header == 'EIND') {
			if (gradeClass.abbreviation == 'gem') {
				overallAverage = gradeGrade;
			} else {
				classAverages[gradeClass.id] = gradeGrade;
			}
		} else if (gradeType._type == 1) {
			if (grade.dateFilledIn <= latestGradeTime) continue;
			gradesToNotify.push(grade);
			if (grade.dateFilledIn > newLatestGradeTime) newLatestGradeTime = grade.dateFilledIn;
		}
	}

	return {
		grades: gradesToNotify,
		averages: classAverages,
		latestGradeTime: newLatestGradeTime,
	};
}

function getFullClassName(gradeClass, classesById) {
	let className = gradeClass.abbreviation;
	if (gradeClass.id in classesById) {
		className = classesById[gradeClass.id].description;
		className = className.replace(/e taal$/i, '');
		className = className.replace(/^cambridge.*$/i, 'engels');
		className = className.replace(/^latijn.*$/i, 'latijn');
		className = className.replace(/^grieks.*$/i, 'grieks');
		className = className.replace(/^spaans.*$/i, 'spaans');
		className = className.replace(/^nederlands.*$/i, 'nederlands');
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
